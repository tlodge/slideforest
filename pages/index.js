import Head from 'next/head'
import {UiFileInputButton} from '../components/ui/UiFileInputButton'
import axios from 'axios'
import {useState, useEffect} from 'react';
import * as d3h from 'd3-hierarchy';
import * as d3z from 'd3-zoom';
import * as d3 from 'd3';
import { interpolatePath } from 'd3-interpolate-path';
import '../styles/Home.module.css';

import {useD3} from '../hooks/useD3.js';




const SLIDEWIDTH  = 192;
const WHRATIO = 0.5625;
const XPADDING = 18;
const YPADDING = 78;
const sw = SLIDEWIDTH;
const sh = SLIDEWIDTH*WHRATIO;
/*const _t1 = {
    "root" : "slide1.jpg",
    "slide1.jpg" : ["slide2.jpg"],
    "slide2.jpg" : ["slide3.jpg"],
    "slide3.jpg" : ["slide4.jpg", "slide5.jpg"],
    "slide4.jpg" : ["slide10.jpg"],
    "slide5.jpg" : ["slide6.jpg", "slide7.jpg", "slide8.jpg", "slide9.jpg"],
}*/

//ISSUE - IT IS POSSIBLE TO DBL CLICK ON A NODE WHEN ANIMATING E.G TARGET GROW!!

//if slide has no children it's not removed?

const _t1 = {
  "root" : "slide1.jpg",
  "slide1.jpg" : ["slide2.jpg"],
  "slide2.jpg" : ["slide3.jpg"],
  "slide3.jpg" : ["slide4.jpg", "slide5.jpg"],
  "slide4.jpg" : ["slide10.jpg"],
  "slide5.jpg" : ["slide6.jpg", "slide7.jpg", "slide8.jpg", "slide9.jpg"],
}

const _t2 = {
  "root": "slide1.jpg",
  "slide1.jpg": ["slide2.jpg"],
  "slide2.jpg": ["slide3.jpg", "slide10.jpg"],
  "slide3.jpg": ["slide5.jpg", "slide7.jpg", "slide8.jpg", "slide9.jpg"],
  "slide4.jpg": [],
  "slide5.jpg": [],
  "slide6.jpg": ["slide4.jpg"],
  "slide7.jpg": ["slide6.jpg"],
  "slide10.jpg": []
}

const _t3 = {
  "root": "slide1.jpg",
  "slide1.jpg": ["slide2.jpg"],
  "slide2.jpg": []
}


const ANIMATION_DURATION = 800;

/*const _t1 = {
  "root": "slide1.jpg",
  "slide1.jpg": ["slide2.jpg"],
  "slide2.jpg": ["slide9.jpg"],
  "slide3.jpg": [],
  "slide4.jpg": ["slide3.jpg", "slide7.jpg"],
  "slide5.jpg": [],
  "slide6.jpg": [],
  "slide7.jpg": [],
  "slide8.jpg": [],
  "slide9.jpg": ["slide10.jpg", "slide8.jpg", "slide4.jpg", "slide10.jpg", "slide6.jpg"], //two 
  "slide10.jpg": ["slide5.jpg"]
}*/



const _flatten = list => list.reduce(
  (a, b) => a.concat(Array.isArray(b) ? _flatten(b) : b), []
);

const _slink = (sx, sy, tx, ty) =>{
  return <line key={`${tx}${ty}`} x1={sx} y1={sy} x2={tx} y2={ty} style={{stroke:"#000", strokeWidth:"2"}}></line>       
}

const _clink = (sx, sy, tx, ty) => {
  return `M ${sx} ${sy} C ${(sx + tx) / 2} ${sy}, ${(sx + tx) / 2} ${ty}, ${tx} ${ty}`;
  
}

const insert = (lookup, slide)=>{
  const children = lookup[slide] || [];
  const [name=["x"]] = (slide || "").split(".");
  return {slide, name, children : children.map(c => insert(lookup, c))}
}

const convertToHierarchy = (lut)=>{
    return insert (lut, lut["root"]);
}

const generatelookuptable = (arr=[], index=0, table={})=>{
  if (Object.keys(table).length <= 0){
    table = {root:arr[0]}
  }
  if (arr.length >= index-1){
    if (arr[index]){
      table[arr[index]] = arr[index+1] ? [arr[index+1]] : [];
      return generatelookuptable(arr, index+1, table);
    }
  }
  return table;
}

const links = (node={})=>{
 
  if (Object.keys(node).length <= 0){
    return [];
  }
  return  _flatten([
    {    
      from : {
        name:node.data.name,
        x: node.x ,
        y: node.y + sh
      },
      to : (node.children||[]).map(c=>({name:c.data.name,x:c.x, y:c.y}))
    },
    ...(node.children || []).map(c=>links(c))
  ]);
}

const _expanded = (arr)=>{
  //TODO: ffs the tos can be {} or []!  FIX THIS!
  return arr.reduce((acc,item)=>{
      const {from={}, to=[]} = item;
      const _to = Array.isArray(to) ? to : [to];
      return [...acc,...(_to.map(t=>({from:from, "to":t})))]
  },[]);
}


const lookuplinks = (lnks)=>{
  return lnks.reduce((acc, link)=>{
    return {
              ...acc,
              [`${link.from.name}_${link.to.name}`]: {from: link.from.name, to: link.to.name, x1:link.from.x, y1: link.from.y, x2:link.to.x, y2:link.to.y} 
          }
  },{})
}


export default function Home() {

  //const [slides, setSlides] = useState(convertToHierarchy(_t1));
  const [path, setPath] = useState("/pdfs/split");

  const [tree, setTree] = useState({});  //can we take this out of state?

  const [lookuptable, setLookuptable] = useState(_t1);
  const [dims, setDims] = useState({w:1000,h:500});
  const [translate, setTranslate]= useState(0);
  const [slide, setSlide] = useState("");
  const [child, setChild] = useState();
  const [parent, setParent] = useState();
  const [count, setCount] = useState(10);

  const onChange = async (formData) => {

    //setLookuptable({});
    const config = {
      headers: { 'content-type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        console.log(`Current progress:`, Math.round((event.loaded * 100) / event.total));
      },
    };
  
    const response = await axios.post('/api/upload', formData, config);
  
    const {nodes,path} = response.data;
    setPath(path);
    //setLookuptable(generatelookuptable(nodes));
   
  };
 
  const updateCount = ()=>{
    setCount(count+1);
  }

  const childSelected =(e,node)=>{
    setChild(node);
  }

  const parentSelected = (e, node)=>{
    setParent(node);
  }

  useEffect(()=>{ 

    if (!child){
       setParent();
       return;
    }

    if (!child || !parent)
      return;

    const {slide:childslide=""} = child.data || {};
    const {slide:parentslide=""} = parent.data || {};
    const lut = {...lookuptable};
    lut[parentslide] = lut[parentslide] || [];
   
    const filtered = Object.keys(lut).reduce((acc, key)=>{
        //ignore root!
        if (key === "root"){
          return {
            ...acc,
            [key]:lut[key]
          }
        }

        const children = lut[key] || [];
        
        if (key==parentslide){
            return {
              ...acc,
              [key]: [...children, childslide]
            }
        }

        
        if (children.indexOf(childslide !== -1)){
          return {
            ...acc,
            [key] : [...children.filter(i=>i!==childslide)]
          }
        }

        //return unchanged
        return {
          ...acc,
          [key] : children,
        }
    },{});

    setLookuptable(filtered);
    setChild();
    setParent();
  },[child, parent]);

  const svgref = useD3(
   
    (svg) => {
      const dgbox = svg.select("g#dragbox");
      svg.call(d3z.zoom().on("zoom",  (e)=>{
        dgbox.attr("transform", e.transform)
      }))
    } 
 ,[]);

//LOTS of gotchas here - need to make sure we re-bind the clicks and that we use useEffect to see the changes to state objects AND
//pass in the changed items
const allexcept = (tree, nodestoignore=[])=>{
  const eligible = [];
  tree.each(n=>{
      if (nodestoignore.indexOf(n.data.name)==-1){
         eligible.push(n.data.name);
      }
  })
  return eligible;
}

const treeref = useD3((root) => {
           
    const jsontree = convertToHierarchy(lookuptable);
    const hier = (d3h.hierarchy(jsontree, d=>d.children));
    const tree   =  d3h.tree().nodeSize([sw+XPADDING,sh+YPADDING])(hier);  
    const _links  = _expanded(links(tree));

    const currentlinks = lookuplinks(_links);
    let eligible = [];

    if (child){
      let nodestoignore = child ? [child.parent.data.name] : [];
      child.each(n=> nodestoignore = [...nodestoignore, n.data.name]);
      eligible = allexcept(tree,nodestoignore);
    }

    root.selectAll("g#slide")
        .data(tree.descendants(), d => d.data.name) //check descendants are changing -- should it not be the name + x,y pos!!????!!!
        .join(
        enter => {

          //render slides!
          const node = enter.append("g")
                            .attr("id", "slide")
                            .attr("transform", (d, i) => `translate(${d.x},${d.y+20})`)
          
          node.append("rect")
              .attr("id", d=>d.data.name)
              .attr("x", 0)
              .attr("y",0)
              .attr("width", sw+12)
              .attr("height",sh+12)
              .style("fill", "rgb(59,59,59)")
              .style("stroke","white")
              .style("stroke-width", "1.87px")
          
          node.append("image")
              .attr('xlink:href', d=>`${path}/${d.data.slide}`)
              .attr("width", `${sw}px`)
              .attr("height",`${sh}px`)
              .attr("x",6)
              .attr("y",6)

          node.append("text")
              .attr("x",0)
              .attr("y",0)
              .text(d=>`${d.data.slide}${count}`)
        },
        update => update,
        
        exit => exit.call(exit =>
              exit.transition()
                  .duration(ANIMATION_DURATION)
                  .delay((d, i) => i * 100)
                  .attr("transform", (d,i) => `translate(${i * 50},50)`)
                  .style("opacity", 0)
                  .remove()
            )
        )//update passed through to this..
        .transition()
        .duration(ANIMATION_DURATION)
        .attr("transform", (d, i) => `translate(${d.x},${d.y+20})`);
        
    //render links!
    const link = root.selectAll("path#link").data(_links, d=>`${d.from.name}${d.to.name}`).join(
          enter => {
            enter.append("path").attr("id", "link").attr("d", l=>{
              return _clink(l.from.x+(sw/2), l.from.y+28, l.to.x+(sw/2), l.to.y);
            })
            .style("stroke","#000")
            .style("opacity",0)
            .style("stroke-width", 2.5)
            .style("fill", "none")
            .transition().duration(ANIMATION_DURATION).style("opacity", 1);
          },
          update=>update,
          exit => exit.call(exit=>exit.remove())
      )
      .transition()
      .duration(ANIMATION_DURATION)
      .attrTween("d", l=>{
          const last = treeref.current.last || {};
          const l1 = last[`${l.from.name}_${l.to.name}`];
          var previous = l1 ?  _clink(l1.x1+(sw/2), l1.y1+28, l1.x2+(sw/2), l1.y2) : _clink(l.from.x+(sw/2), l.from.y+28, l.to.x+(sw/2), l.to.y);
          var current =  _clink(l.from.x+(sw/2), l.from.y+28, l.to.x+(sw/2), l.to.y);
          return interpolatePath(previous, current);
      }).on("end", ()=>{
        treeref.current.last = currentlinks; //memoise the previous links
      });
    

    //render targets!
    root.selectAll("g#target")
        .data(tree.descendants(), d => `${d.data.name}`)
        .join(
          enter=>{
            const target = enter.append("g").attr("id", "target").attr("transform", d=>`translate(${d.x-sw/2}, ${d.y})`)
          
            //to target
            target.append("circle").attr("id", "bigtotarget").attr("cx",sw).attr("cy", 0).attr("r", 8).style("fill","#fff").style("stroke","#762bae").attr("stroke-width",2.5);
            target.append("circle").attr("id", "smalltotarget").attr("cx",sw).attr("cy", 0).attr("r", 3).style("fill","#ae2b4d").style("stroke","#6F67CC").attr("stroke-width",2.5);

            //from target
            target.append("circle").attr("id", "bigfromtarget").attr("cx",sw).attr("cy", sh+28).attr("r",  8).style("fill","#fff").style("stroke","#ae2b4d").attr("stroke-width",2.5).on("click", parentSelected)
            target.append("circle").attr("id", "smallfromtarget").attr("cx",sw).attr("cy", sh+28).attr("r",  3).style("fill","#ae2b4d").style("stroke","#cc6767").attr("stroke-width",2.5).on("click",parentSelected)
            
            target.append("line")
                  .attr("x1",sw-20).attr("x2",sw-8).attr("y1",0).attr("y2",0)
                  .style("stroke","#000")
                  .style("stroke-width", 2.5)
                  .style("fill", "#fff")
            
            target.append("line")
                  .attr("x1",sw+20).attr("x2",sw+8).attr("y1",0).attr("y2",0)
                  .style("stroke","#000")
                  .style("stroke-width", 2.5)
                  .style("fill", "#fff")
          },
          update=>{
            update.transition().duration(ANIMATION_DURATION).attr("transform", d=>`translate(${d.x-sw/2}, ${d.y})`)
            update.selectAll("circle#bigfromtarget").on("click", parentSelected).transition().duration(ANIMATION_DURATION).attr("r", d=>eligible.indexOf(d.data.name) == -1 ? 8 :  12)
            update.selectAll("circle#smallfromtarget").on("click", parentSelected).transition().duration(ANIMATION_DURATION).attr("r", d=>eligible.indexOf(d.data.name) == -1 ? 3 : 5).attr("class", d=>eligible.indexOf(d.data.name) == -1 ? "":"pulse");
           
          },
          exit=> exit.call(exit=>exit.remove())
           
          
        )
       

    //* now add the control bar
    root.selectAll("g#childslides")
        .data(tree.descendants(), d => d.data.name)
        .join(
            enter=>{
                  const target = enter.append("g").attr("id", "childslides").attr("transform", d=>`translate(${d.x-sw/2}, ${d.y})`)
                  .append("circle").attr("cx",sw-30).attr("cy", 0).attr("r",10).style("fill", "#fff").style("stroke", "#000").attr("stroke-width",2.5).on("click",childSelected)
            },
            update=> {
              update.on("click", childSelected)
              update.transition().duration(ANIMATION_DURATION).attr("transform", d=>`translate(${d.x-sw/2}, ${d.y})`)
              
              if (child){
                update.selectAll("circle").style("stroke", (d)=>child.data.name == d.data.name ? "#762bae" : "black");
                update.selectAll("circle").style("fill", (d)=>child.data.name == d.data.name ? "#496A77" : "white");
              }
            },
            exit=> exit.call(exit=>exit.remove())
        )
        

    root.selectAll("g#oneslide")
        .data(tree.descendants(), d => d.data.name)
        .join(
            enter=>{
                const target = enter.append("g").attr("id", "oneslide").attr("transform", d=>`translate(${d.x-sw/2}, ${d.y})`)
                .append("circle").attr("cx",sw+30).attr("cy", 0).attr("r",10).style("fill", "#fff").style("stroke", "#000").attr("stroke-width",2.5).on("click",childSelected)
            },
            update=>update,
            exit=> exit.call(exit=>exit.remove())
        ).on("click", childSelected)
        .transition().duration(ANIMATION_DURATION)
         .attr("transform", d=>`translate(${d.x-sw/2}, ${d.y})`)
         .style("fill", "#fff")

      
  }, [lookuptable, child]);

 
  //can we do the rendertree, renderlinks and rendertargets in d3 hook?  
  //we can even have two ref objects to deal with the zoom box?
  return (
    <div >
      <Head>
        <title>Slide Forest</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
            <UiFileInputButton label="Upload Single File" uploadFileName="thePdf" onChange={onChange}/>
            <div className="flex justify-center items-center">
            
            <svg ref={svgref} width={`${Math.max(dims.w, 500)}px`} height={`${dims.h}px`}>
                <g id="dragbox">
                    <g ref={treeref}>
                      
                    </g>
                </g>
            </svg>
           
            </div>
      </main>
    </div>
  )
}
