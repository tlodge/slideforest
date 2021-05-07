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

const t1 = {
    slide: "slide1.jpg", children :[
          {
            slide: "slide2.jpg",
            children: [
               {
                 slide: "slide3.jpg",
                 children: [
                    {
                      slide: "slide4.jpg",
                      children: [],
                    },
                    {
                      slide: "slide5.jpg",
                      children: [],
                    }
                 ]
               }

            ]
          }
    ]
}

export default function Home() {

  //const [slides, setSlides] = useState(convertToHierarchy(_t1));
  const [path, setPath] = useState("/pdfs/split");

  const [tree, setTree] = useState({});  //can we take this out of state?

  const [clear, setClear] = useState(false);
  const [lookuptable, setLookuptable] = useState(_t1);
  const [dims, setDims] = useState({w:1000,h:500});
  
  const [translate, setTranslate]= useState(0);
  const [child, setChild] = useState();
  

  //useEffect(()=>{
  //  setSlideHeight(sw*WHRATIO);
  //}, [sw]);

  useEffect(()=>{
    d3.selectAll("circle#bigtarget").transition().duration(1000).attr("r", 8);
    d3.selectAll("circle#smalltarget").transition().duration(1000).attr("r", 3);
    d3.selectAll("g#slide").selectAll("rect").style("fill", "white");
  },[clear]);

  const onChange = async (formData) => {

    setLookuptable({});
    const config = {
      headers: { 'content-type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        console.log(`Current progress:`, Math.round((event.loaded * 100) / event.total));
      },
    };
  
    const response = await axios.post('/api/upload', formData, config);
  
    const {nodes,path} = response.data;
    setPath(path);
    setLookuptable(generatelookuptable(nodes));
   
  };
  /*
    {renderTree(tree)}
    {renderLinks(links(tree))}
    {renderTargets(tree)}
  */

//only ever need to call this once!!

 const svgref = useD3(
   
    (svg) => {
      const dgbox = svg.select("g#dragbox");
      svg.call(d3z.zoom().on("zoom",  (e)=>{
        dgbox.attr("transform", e.transform)
      }))
    } 
 ,[]);

const treeref = useD3(root => {
        // Inside the callback function, we can use D3
          let data = [];
        //const trees = [_t1,_t2,_t3];
        //let index = 0;
        //const randomData = ()=>{
          const jsontree = convertToHierarchy(lookuptable);
         
          //index = (index + 1)%3;
          const hier = (d3h.hierarchy(jsontree, d=>d.children));
          const _tree = d3h.tree().nodeSize([sw+XPADDING,sh+YPADDING])(hier);  
         
          
        //}
        //setInterval(()=>{
          
          data =  _tree.descendants();
          root.selectAll("g#slide")
              .data(data, d => d.data.name)
              .join(
              enter => {
                const node = enter.append("g").attr("id", "slide").attr("transform", (d, i) => `translate(${d.x},${d.y+20})`) 
                node.append("rect").attr("id", d=>d.data.name).attr("x", 0).attr("y",0).attr("width", sw+12).attr("height",sh+12).style("fill", "rgb(59,59,59)").style("stroke","white").style("stroke-width", "1.87px")
                node.append("image").attr('xlink:href', d=>`${path}/${d.data.slide}`).attr("width", `${sw}px`).attr("height",`${sh}px`).attr("x",6).attr("y",6)
              },
              update => update,
              exit => exit
                  .call(exit =>
                  exit.transition()
                      .duration(1000)
                      .delay((d, i) => i * 100)
                      .attr("transform", (d,i) => `translate(${i * 50},50)`)
                      .style("opacity", 0)
                      .remove()
                  )
              )//following is the update I think!
              .transition()
              .duration(1000)
              .delay((d, i) => i * 100)
              .attr("transform", (d, i) => `translate(${d.x},${d.y+20})`)
     // },2000);
  }, [lookuptable]);

 
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
