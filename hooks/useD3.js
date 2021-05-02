import React from 'react';
import * as d3 from 'd3';

export const useD3 = (d3Fn, dependencies) => {
    const ref = React.useRef();

    React.useEffect(() => {
        d3Fn(d3.select(ref.current));
        return () => {};
      }, dependencies);
    return ref;
}