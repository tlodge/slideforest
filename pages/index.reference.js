import * as d3h from 'd3-hierarchy';
import * as d3z from 'd3-zoom';
import * as d3 from 'd3';
import { interpolatePath } from 'd3-interpolate-path';
import '../styles/Home.module.css';

import {useD3} from '../hooks/useD3.js';
export default function Home(){
    // The useD3 hook gives us a ref that is turned into a d3 Selection
    // (the first argument to useD3's callback function, here called `root`)
   
    function randomData() {
        return d3.shuffle(["😀", "😙", "🤓", "😎", "😍", "🤩", "😴"])
          .slice(0, Math.floor(2 + Math.random() * 5))
          ;
    }
    const ref = useD3(root => {
      // Inside the callback function, we can use D3
      let data = [];
      
      setInterval(()=>{
        
        data = randomData();
        root.selectAll("div")
            .data(data, d => d)
            .join(
            enter => enter
                .append("div")
                .style("position", "absolute")
                .style("transform", (d, i) => `translate(${i * 50}px,-50px)`) 
                .style("opacity", 0)
                .style("font-size", "50px")
                .style("line-height", 1)
                .text(d => d),
            update => update,
            exit => exit
                .call(exit =>
                exit.transition()
                    .duration(1000)
                    .delay((d, i) => i * 100)
                    .style("transform", (d,i) => `translate(${i * 50}px,50px)`)
                    .style("opacity", 0)
                    .remove()
                )
            )
            .transition()
            .duration(1000)
            .delay((d, i) => i * 100)
            .style("transform", (d, i) => `translate(${i * 50}px,0px)`)
            .style("opacity", 1);
    },2000);
    });

    return <div ref={ref}></div>
}