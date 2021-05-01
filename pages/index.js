import Head from 'next/head'
import styles from '../styles/Home.module.css'
import {UiFileInputButton} from '../components/ui/UiFileInputButton'
import axios from 'axios'
import {useState, useEffect} from 'react';
import * as d3 from 'd3-hierarchy';




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
  return <path d={`M ${sx},${sy} C ${(sx + tx) / 2},${sy} ${(sx + tx) / 2},${ty} ${tx},${ty}`}/>;
}

const links = (node={})=>{
 
  if (Object.keys(node).length <= 0){
    return [];
  }
  return _flatten([
    {    
      from : {
        name:node.data.slide,
        x: node.x,
        y: node.y +110
      },
      to : (node.children||[]).map(c=>({slide:c.data.slide,x:c.x, y:c.y}))
    },
    ...(node.children || []).map(c=>links(c))
  ])
}


const insert = (lookup, slide)=>{
  const children = lookup[slide] || [];
  return {slide, children : children.map(c => insert(lookup, c))}
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
  const [translate, setTranslate]= useState(0);

  const [child, setChild] = useState();

  useEffect(()=>{

    const _tree = d3.tree().nodeSize([210,180])(d3.hierarchy(convertToHierarchy(lookuptable), d=>d.children))
    
    //get dimensions of tree for rendering!
    const leaves = _tree.leaves();
    console.log(leaves);
    const minmax = leaves.reduce((acc, node)=>{
          return {minx:Math.min(acc.minx, node.x), maxx:Math.max(acc.maxx, node.x),miny:Math.min(acc.miny, node.y), maxy:Math.max(acc.maxy, node.y)}
    }, {minx:0, maxx:0, miny:0, maxy:0});

    console.log(minmax);
    const _translate = Math.abs(minmax.minx);
    setDims({w: (minmax.maxx-minmax.minx)+210, h:(minmax.maxy-minmax.miny)+180});
    setTranslate(_translate);
    console.log(minmax, _translate);
    setTree(_tree);
    setChild();
  }, [lookuptable])

  const walk = (tree={})=>{
    const {children=[]} = tree;
    if (children.length == 0)
      return -1;
    return 1 + walk(children[0]);
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
                <g key={id} transform={`translate(${node.x}, ${node.y})`}  id="Artboard11">
                  <defs>
                      <image id={`_Image1${id}`} width="192px" height="108px" xlinkHref={`${path}/${node.data.slide}`}/>
                  </defs>
                
                  <use onClick={()=>{nodeSelected(node.data.slide)}} id="pg_0001.png" xlinkHref={`#_Image1${id}`} x="0" y="0" width="192px" height="108px"/>
                 
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
      return  (<g>
                <circle cx="192" cy="110" r="8" style={{fill:"#fff",stroke:"#ae2b4d",strokeWidth:"2.5px"}}/>
                <circle cx="192" cy="110" r="3" style={{fill:"#ae2b4d",stroke:"#cc6767",strokeWidth:"2.5px"}}/></g>)
    }

    const renderToTargets = ()=>{
      return  (<g>
                  <circle cx="192" cy="0" r="8" style={{fill:"#fff",stroke:"#762bae",strokeWidth:"2.5px"}}/>
                  <circle cx="192" cy="0" r="3" style={{fill:"#ae2b4d",stroke:"#6F67CC",strokeWidth:"2.5px"}}/></g>)
    }

    return <g key={id}> 
                <g key={id} transform={`translate(${node.x - (192/2)}, ${node.y})`}  id="Artboard11">
                
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
                        {_slink(link.from.x+96, link.from.y, l.x+96, l.y)}
                   </g>
        });
    });
}

  return (
    <div className={styles.container}>
      <Head>
        <title>Slide Forest</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
          <UiFileInputButton
      label="Upload Single File"
      uploadFileName="thePdf"
      onChange={onChange}
    />
    <svg width={`${dims.w}px`} height={`${dims.h}px`}>
      <g transform={`translate(${translate},0)`}>
        {renderTree(tree)}
        {renderLinks(links(tree))}
        {renderTargets(tree)}
        </g>
    </svg>

      </main>
    </div>
  )
}
