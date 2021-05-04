import Head from 'next/head'
import {UiFileInputButton} from '../components/ui/UiFileInputButton'
import axios from 'axios'
import {useState, useEffect} from 'react';
import * as d3h from 'd3-hierarchy';
import * as d3z from 'd3-zoom';
import * as d3 from 'd3';
import {useD3} from '../hooks/useD3.js';



const SLIDEWIDTH  = 192;
const WHRATIO = 0.5625;
const XPADDING = 18;
const YPADDING = 78;

const _t1 = {
    "root" : "slide1.jpg",
    "slide1.jpg" : ["slide2.jpg"],
    "slide2.jpg" : ["slide3.jpg"],
    "slide3.jpg" : ["slide4.jpg", "slide5.jpg"],
    "slide4.jpg" : ["slide10.jpg"],
    "slide5.jpg" : ["slide6.jpg", "slide7.jpg", "slide8.jpg", "slide9.jpg"],
}


const _flatten = list => list.reduce(
  (a, b) => a.concat(Array.isArray(b) ? _flatten(b) : b), []
);

const _slink = (sx, sy, tx, ty) =>{
  return <line key={`${tx}${ty}`} x1={sx} y1={sy} x2={tx} y2={ty} style={{stroke:"#000", strokeWidth:"2"}}></line>       
}

const _clink = (sx, sy, tx, ty) => {
  return <path d={`M ${sx} ${sy} C ${(sx + tx) / 2} ${sy}, ${(sx + tx) / 2} ${ty}, ${tx} ${ty}`} style={{stroke:"#000", strokeWidth:"2.5", fill:"none"}}></path> 
}

const insert = (lookup, slide)=>{
  const children = lookup[slide] || [];
  return {slide, name: slide.split(".")[0], children : children.map(c => insert(lookup, c))}
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

  const [tree, setTree] = useState({});
  const [lookuptable, setLookuptable] = useState(_t1);
  const [dims, setDims] = useState({w:0,h:0});
  const [sw, setSlideWidth] = useState(SLIDEWIDTH);
  const [sh, setSlideHeight] = useState(SLIDEWIDTH*WHRATIO)
  const [translate, setTranslate]= useState(0);
  const [child, setChild] = useState();
  

  useEffect(()=>{
    setSlideHeight(sw*WHRATIO);
  }, [sw]);

  const slidetree = useD3(
   
    (svg) => {
      console.log("AM IN USE D3");
      const dgbox = svg.select("g#dragbox");
    
      svg.call(d3z.zoom().on("zoom",  (e)=>{
        dgbox.attr("transform", e.transform)
      }))
     
    } 
  ,[translate]);

  useEffect(()=>{
    const _tree = d3h.tree().nodeSize([sw+XPADDING,sh+YPADDING])(d3h.hierarchy(convertToHierarchy(lookuptable), d=>d.children))
    
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
          name:node.data.slide,
          x: node.x + translate,
          y: node.y + sh
        },
        to : (node.children||[]).map(c=>({slide:c.data.slide,x:c.x+translate, y:c.y}))
      },
      ...(node.children || []).map(c=>links(c))
    ])
  }
  
  /*const treelength = (tree={})=>{
    //const {children=[]} = tree[root];
    return walk(tree);
  }

  const children = (arr=[], index=0)=>{

    if (arr.length > index-1){
      return {slide:arr[index], children: [children(arr, index+1)]};
    }
    return {slide:arr[index], children:[]};
  }*/

 
  
  //
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
    console.log("have slides", nodes, path);
    
    setLookuptable(generatelookuptable(nodes));
    console.log('response', nodes);
  };

 
 

  const parentfor = (node)=>{
      const keys = Object.keys(lookuptable);

      for (let i = 0; i < keys.length; i++){
         if ((lookuptable[keys[i]] || []).indexOf(node) !== -1){
           return keys[i];
         }
      }   
      return null;
  }

  const makeParent = (parent, child)=>{
      

    
      const _children     = [...lookuptable[child]];
      const _childparent  = parentfor(child);

     
      const filtered = Object.keys(lookuptable).reduce((acc, key)=>{
          //ignore root!
          if (key === "root"){
            return {
              ...acc,
              [key]:lookuptable[key]
            }
          }

          const children = lookuptable[key] || [];
          
          if (key==parent){
              return {
                ...acc,
                [key]: [...children, child]
              }
          }

          
          if (children.indexOf(child !== -1)){
            return {
              ...acc,
              [key] : [...children.filter(i=>i!==child)]
            }
          }

          //return unchanged
          return {
            ...acc,
            [key] : children,
          }
      },{});

      setLookuptable(filtered);
  }

  const nodeSelected  = (node)=>{
      if (child){
        
          makeParent(node, child);
         
      }else{
        setChild(node);
      }
  }

  const renderTree = (node)=>{
    if (Object.keys(node).length <= 0){
      return;
    }

    const id = `n${node.x}${node.y}`;

    return <g key={id}> 
     
                <g key={id} id="slide" transform={`translate(${node.x+translate}, ${node.y+20})`}>
                 
                  <defs>
                      <image id={`_Image1${id}`} width={`${sw}px`} height={`${sh}px`} xlinkHref={`${path}/${node.data.slide}`}/>
                  </defs>
                  <rect id={`${node.data.name}`} x={0} y={0} width={SLIDEWIDTH+12} height={(SLIDEWIDTH*WHRATIO)+12} style={{fill:"rgb(59,59,59)",stroke:"white",strokeWidth:"1.87px"}}/>
                  <use onClick={()=>{nodeSelected(node.data.slide)}} id="pg_0001.png" xlinkHref={`#_Image1${id}`} x="6" y="6" width={`${sw}px`} height={`${sh}px`}/>
                 
                </g>)
                {(node.children || []).map(n=>renderTree(n))}
          </g>
  }

  
  const renderTargets = (node)=>{
    if (Object.keys(node).length <= 0){
      return;
    }
    const id = `t${node.x}${node.y}`;

    const haschildren = (node.children || []).length > 0;
    const hasparent = node.parent != null;

    const renderFromTargets = ()=>{
      return  (<g id={`from${node.data.name}`}>
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

          const rectgroup = [0,1,2].map(i=><rect x={sw-36+(2*i)} y={-5+(2*i)} width={8} height={6} style={{strokeWidth:1, fill:"white", stroke:"black"}}/>);
          let selected = [];

          const selectsubtree = (e, node)=>{
            
            d3.selectAll("g#slide").selectAll("rect").style("fill", "white");
            d3.selectAll("circle#bigtarget").attr("r", 8);
            d3.selectAll("circle#smalltarget").attr("r", 3);

            if (selected.length > 0){
              selected = [];
              return;  
            }
            node.each(n=>{
              selected = [...selected, n];
              d3.select(`rect#${n.data.name}`).style("fill", "#CC6767");
            });

            const parentfor = (n={})=>{
              const parent = n.parent;

              if (!parent)
                return;
              
              d3.select(`g#from${parent.data.name}`).selectAll("circle#bigtarget").attr("r", 12);
              d3.select(`g#from${parent.data.name}`).selectAll("circle#smalltarget").attr("r", 8);

              parentfor(parent);
            }
            parentfor(node.parent);
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
                  {haschildren && renderFromTargets()}
                  
                </g>)
                {(node.children || []).map(n=>renderTargets(n))}
          </g>
  }


  const renderLinks = (links)=>{
    return links.map((link)=>{

        return link.to.map((l)=>{

            return <g key={`${l.x},${l.y}`}>
                        {_clink(link.from.x+(sw/2), link.from.y+28, l.x+(sw/2), l.y)}
                        <line x1={l.x+(sw/2)} x2={l.x+(sw/2)} y1={l.y} y2={l.y+20} style={{strokeWidth:2.5, stroke:"black"}}/>
                   </g>
        });
    });
}
//transform={`translate(${translate},0)`}>
  return (
    <div >
      <Head>
        <title>Slide Forest</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <button onClick={()=>setCount(count+1)}>click me!</button>
            <UiFileInputButton label="Upload Single File" uploadFileName="thePdf" onChange={onChange}/>
            <svg ref={slidetree} width={`${dims.w}px`} height={`${dims.h}px`}>
              
              <g id="dragbox"  style={{fill:"red"}}> 
                {renderTree(tree)}
                {renderLinks(links(tree))}
                {renderTargets(tree)}
                </g>
                
            </svg>
      </main>
    </div>
  )
}
