import Head from 'next/head'
import {UiFileInputButton} from '../components/ui/UiFileInputButton'
import axios from 'axios'
import {useState, useEffect} from 'react';
import * as d3h from 'd3-hierarchy';
import * as d3z from 'd3-zoom';
import * as d3 from 'd3';
import { interpolatePath } from 'd3-interpolate-path';

import {useD3} from '../hooks/useD3.js';



const SLIDEWIDTH  = 192;
const WHRATIO = 0.5625;
const XPADDING = 18;
const YPADDING = 78;

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
  const [dims, setDims] = useState({w:0,h:0});
  const [sw, setSlideWidth] = useState(SLIDEWIDTH);
  const [sh, setSlideHeight] = useState(SLIDEWIDTH*WHRATIO)
  const [translate, setTranslate]= useState(0);
  const [child, setChild] = useState();
  

  useEffect(()=>{
    setSlideHeight(sw*WHRATIO);
  }, [sw]);

  useEffect(()=>{
    d3.selectAll("circle#bigtarget").transition().duration(1000).attr("r", 8);
    d3.selectAll("circle#smalltarget").transition().duration(1000).attr("r", 3);
    d3.selectAll("g#slide").selectAll("rect").style("fill", "white");
  },[clear]);

  const slidetree = useD3(
   
    (svg) => {
      
      const dgbox = svg.select("g#dragbox");
    
      svg.call(d3z.zoom().on("zoom",  (e)=>{
        dgbox.attr("transform", e.transform)
      }))
    
     //think we need all d3/svg magic in here
    } 
  ,[]);//translate, clear]);


  const lookupcoords = (node={})=>{
    if (Object.keys(node).length <= 0){
      return {};
    }

    const coords = {};
    node.each(n=>coords[n.data.name] = {x:n.x,y:n.y});
    return coords;
  }

  const lookuplinks = (lnks)=>{
      return lnks.reduce((acc, link)=>{
        return {...acc,
            ...link.to.reduce((acc, item)=>{
              return {
                ...acc,
                [`${link.from.name}_${item.name}`]: {from: link.from.name, to: item.name, x1:link.from.x, y1: link.from.y, x2:item.x, y2:item.y} 
              }
            },{})
        }
      },{})
  }

  useEffect(()=>{
    
   
    const _lut = {...lookuptable};
    const _tree = d3h.tree().nodeSize([sw+XPADDING,sh+YPADDING])(d3h.hierarchy(convertToHierarchy(_lut), d=>d.children))  
    
    //get dimensions of tree for rendering!
    const leaves = _tree.leaves();
   
    const minmax = leaves.reduce((acc, node)=>{
          return {minx:Math.min(acc.minx, node.x), maxx:Math.max(acc.maxx, node.x),miny:Math.min(acc.miny, node.y), maxy:Math.max(acc.maxy, node.y)}
    }, {minx:0, maxx:0, miny:0, maxy:0});

    const _translate = Math.abs(minmax.minx);
    setDims({w: (minmax.maxx-minmax.minx)+sw+XPADDING, h:(minmax.maxy-minmax.miny)+sh+YPADDING});
    setTranslate(_translate);
    setTree(_tree);
    setChild();
   
  }, [lookuptable])

  const walk = (tree={})=>{
    const {children=[]} = tree;
    if (children.length == 0)
      return -1;
    return 1 + walk(children[0]);
  }

  const links = (node={})=>{
 
    if (Object.keys(node).length <= 0){
      return [];
    }
    return _flatten([
      {    
        from : {
          name:node.data.name,
          x: node.x + translate,
          y: node.y + sh
        },
        to : (node.children||[]).map(c=>({name:c.data.name,x:c.x+translate, y:c.y}))
      },
      ...(node.children || []).map(c=>links(c))
    ])
  }
  
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

  const makeParent = (parent, child)=>{
      const _svg = d3.select("svg");
      _svg.style("pointer-events", "none");
      
      let lut = {...lookuptable};


      const {slide:childslide=""} = child.data || {};
      const {slide:parentslide=""} = parent.data || {};

      //parent may be a leaf, and so have no entry in the lookup table!
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

          
          if (children.indexOf(child !== -1)){
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

      const coords = lookupcoords(tree);

    
      const newtree = d3h.tree().nodeSize([sw+XPADDING,sh+YPADDING])(d3h.hierarchy(convertToHierarchy(filtered), d=>d.children))  
      const newcoords = lookupcoords(newtree);
      
      const linkcoords =  lookuplinks(links(tree));
      const newlinkcoords = lookuplinks(links(newtree));

     
      
      
      
      let count = Object.keys(newcoords || {}).length || 0;
     

      /*Object.keys(linkcoords).map((key)=>{
        d3.select(`g#${key}`).select("path").transition().duration(300).attrTween('d', (d)=>{
          const l1 = linkcoords[key];
          const l2 = newlinkcoords[key] || l1; 
            var previous = _clink(l1.x1+(sw/2), l1.y1+28, l1.x2+(sw/2), l1.y2);
            var current =  _clink(l2.x1+(sw/2), l2.y1+28, l2.x2+(sw/2), l2.y2);
            return interpolatePath(previous, current);
        });
      })*/

      if (count <= 0){
        _svg.style("pointer-events", "all");
      }
      console.log("animating");

      console.log("OK COORDS TO TRANSFORM ARE", coords);
      console.log("AND NEW COORDS ARE",newcoords);
      console.log("filtered is", filtered);

      //I think that because this changes the dom, and react then changes the DOM too, we get inconsistencies.  Could ALL tree rendering
      //be done by d3?  Happens only in (some) cases where tree is made wide then thin again.
      
      /* Object.keys(coords).map((key)=>{
        const {x:x1,y:y1} = newcoords[key];
        const {x:x2,y:y2} = coords[key];
        if (x1 !== x2 || y1 != y2){
          console.log(`d3.select(g#slide_${key}).attr("transform", translate(${x1+translate}, ${y1+20}))`);
          d3.select(`g#slide_${key}`).attr("transform", `translate(${x1+translate}, ${y1+20})`);
        }
        d3.selectAll(`g#slide_${key}`).transition().duration(6000).attr("transform", `translate(${x1+translate}, ${y1+20})`).on("end", ()=>{
            count -= 1;
            if (count <= 0){
              _svg.style("pointer-events", "all");
              console.log("finished animating");
              setLookuptable(filtered)
            }
          });
        }
        count-=1;
      });*/
      
      _svg.style("pointer-events", "all");
      setLookuptable(filtered);
  
  }

  const nodeSelected  = (e,node)=>{
      e.stopPropagation();
      if (child){
          makeParent(node, child);  
          setClear(!clear);
      }
  }

  const renderTree = (_tree)=>{

    console.log("in render tree with", _tree);

    if (Object.keys(_tree).length <= 0){
      return;
    }

    const slides = [];

    _tree.each(node=>{
      const id = `n${node.x}${node.y}`;

      slides.push(<g key={id} id="slide"> 
                  <g id={`slide_${node.data.name}`} transform={`translate(${node.x+translate}, ${node.y+20})`}>
                    <defs>
                        <image id={`_Image1${id}`} width={`${sw}px`} height={`${sh}px`} xlinkHref={`${path}/${node.data.slide}`}/>
                    </defs>
                    <rect id={`${node.data.name}`} x={0} y={0} width={SLIDEWIDTH+12} height={(SLIDEWIDTH*WHRATIO)+12} style={{fill:"rgb(59,59,59)",stroke:"white",strokeWidth:"1.87px"}}/>
                    <use id="pg_0001.png" xlinkHref={`#_Image1${id}`} x="6" y="6" width={`${sw}px`} height={`${sh}px`}/>
                    <text x={0} y={0}>{`${node.data.name}:${node.x},${node.y}`}</text>
                  </g>
                 
            </g>);

    })
    return slides;
    
  }

  
  const renderTargets = (node)=>{
    if (Object.keys(node).length <= 0){
      return;
    }
    const id = `t${node.x}${node.y}`;

    const haschildren = (node.children || []).length > 0;
    const hasparent = node.parent != null;

    const renderFromTargets = ()=>{
      return  (<g id={`from${node.data.name}`} onClick={(e)=>{nodeSelected(e,node)}}>
                <circle id="bigtarget" cx={sw} cy={sh+28} r="8" style={{fill:"#fff",stroke:"#ae2b4d",strokeWidth:"2.5px"}}/>
                <circle id="smalltarget" cx={sw} cy={sh+28} r="3" style={{fill:"#ae2b4d",stroke:"#cc6767",strokeWidth:"2.5px"}}/>  
              </g>)
    }

    const renderToTargets = ()=>{
      return  (<g>
                  {renderControlBar()}
                  <circle cx={sw} cy="0" r="8" style={{fill:"#fff",stroke:"#762bae",strokeWidth:"2.5px"}}/>
                  <circle cx={sw} cy="0" r="3" style={{fill:"#ae2b4d",stroke:"#6F67CC",strokeWidth:"2.5px"}}/>
              </g>)
    }

    const renderControlBar = ()=>{

          const rectgroup = [0,1,2].map(i=><rect key={i} x={sw-36+(2*i)} y={-5+(2*i)} width={8} height={6} style={{strokeWidth:1, fill:"white", stroke:"black"}}/>);
          let selected = [];

          const selectsubtree = (e, node)=>{
            e.stopPropagation();
            d3.selectAll("g#slide").selectAll("rect").style("fill", "white");
            d3.selectAll("circle#bigtarget").attr("r", 8);
            d3.selectAll("circle#smalltarget").attr("r", 3);

            if (selected.length > 0){
              selected = [];
              setChild();
              return;  
            }

            setChild(node);
            node.each(n=>{
              selected = [...selected, n];
              d3.select(`rect#${n.data.name}`).style("fill", "#CC6767");
            });

            const allexcept = (nodestoignore=[])=>{
                const eligible = [];
                tree.each(n=>{
                    if (nodestoignore.indexOf(n.data.name)==-1){
                       eligible.push(n.data.name);
                    }
                })
                return eligible;
            }

           
            const highlightTargets = (node)=>{
              let nodestoignore = [node.parent.data.name];
              node.each(n=> nodestoignore = [...nodestoignore, n.data.name])
              const eligible = allexcept(nodestoignore);
              eligible.forEach(n=>{
                d3.select(`g#from${n}`).selectAll("circle#bigtarget").transition().duration(1000).attr("r", 12);
                d3.select(`g#from${n}`).selectAll("circle#smalltarget").transition().duration(1000).attr("r", 8);
              });

            }
            
            highlightTargets(node);
            
          }
          
          return <g id ={node.data.name}>
                    
                    <g onClick={(e)=>selectsubtree(e,node)}> 
                      <circle  cx={sw-30} cy="0" r="10" style={{fill:"#fff",stroke:"black",strokeWidth:"2.5px"}}/>
                      {rectgroup}
                    </g>

                    <circle cx={sw+30} cy="0" r="10" style={{fill:"#fff",stroke:"black",strokeWidth:"2.5px"}}/>
                    <line x1={sw-20} x2={sw-8} y1={0} y2={0} style={{strokeWidth:2.5, stroke:"black"}}/>
                    <line x1={sw+20} x2={sw+8} y1={0} y2={0} style={{strokeWidth:2.5, stroke:"black"}}/>
                   
                    <rect x={sw+25} y={-4} width={10} height={8} style={{strokeWidth:1, fill:"white", stroke:"black"}}/>;
                  </g>
          
    }

   

    return <g key={id}> 
                <g key={id} transform={`translate(${node.x + translate - (sw/2)}, ${node.y})`}  id="Artboard11">
                
                  {hasparent && renderToTargets()}
                  {renderFromTargets()}
                  
                </g>)
                {(node.children || []).map(n=>renderTargets(n))}
          </g>
  }


  const renderLinks = (links)=>{
    return links.map((link)=>{

        return link.to.map((l)=>{

            return <g id={`${link.from.name}_${l.name}`} key={`${l.x},${l.y}`}>
                        <path d={_clink(link.from.x+(sw/2), link.from.y+28, l.x+(sw/2), l.y)} style={{stroke:"#000", strokeWidth:"2.5", fill:"none"}}></path>
                        <line x1={l.x+(sw/2)} x2={l.x+(sw/2)} y1={l.y} y2={l.y+20} style={{strokeWidth:2.5, stroke:"black"}}/>
                   </g>
        });
    });
}
  
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
            <svg onClick={()=>{setClear(!clear)}} width={`${Math.max(dims.w, 500)}px`} height={`${dims.h}px`}>
              <g ref={slidetree}>
                <g  id="dragbox"> 
                  {renderTree(tree)}
                  {renderLinks(links(tree))}
                  {renderTargets(tree)}
                </g>
              </g>
            </svg>
            </div>
      </main>
    </div>
  )
}
