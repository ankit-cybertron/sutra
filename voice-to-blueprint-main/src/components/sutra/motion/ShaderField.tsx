import { useEffect, useRef, type MutableRefObject } from "react";
import { cn } from "@/lib/utils";

// Live WebGL "threads" field (sutra = thread). Lines flow over time, bend toward the cursor,
// and swell with the live microphone level when a levelRef is provided.
const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
const FRAG = `
precision highp float;
uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse; uniform float u_level; uniform float u_count;
vec3 pal(float t){
  vec3 a = vec3(1.0,0.62,0.22); vec3 b = vec3(0.93,0.24,0.40); vec3 c = vec3(0.22,0.40,0.96);
  t = fract(t);
  return t < 0.5 ? mix(a,b,t*2.0) : mix(b,c,(t-0.5)*2.0);
}
void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (gl_FragCoord.xy - 0.5*u_res) / u_res.y;
  vec2 mp = (u_mouse*u_res - 0.5*u_res) / u_res.y;
  vec3 col = vec3(0.0); float alpha = 0.0;
  for (int i = 0; i < 18; i++) {
    float fi = float(i);
    if (fi >= u_count) break;
    float off = (fi - u_count*0.5) * 0.028;
    float amp = 0.10 + 0.05*sin(fi*1.7) + u_level*0.22;
    float y = off + amp * sin(p.x*(1.6 + fi*0.09) + u_time*(0.35 + fi*0.025) + fi*0.6)
                  * (0.65 + 0.35*sin(u_time*0.25 + fi));
    float infl = exp(-5.0*pow(p.x - mp.x, 2.0));
    y = mix(y, mp.y + off*1.6, infl*0.55);
    float d = abs(p.y - y);
    float w = 0.0018 + 0.0012*sin(fi*2.3) + u_level*0.002;
    float line = smoothstep(w*3.0, 0.0, d) + 0.25*w/(d+0.002);
    line = clamp(line, 0.0, 1.0);
    col += pal(uv.x*0.7 + fi*0.035 + u_time*0.02) * line;
    alpha += line;
  }
  float vig = smoothstep(1.15, 0.15, length(p*vec2(0.8,1.1)));
  alpha = clamp(alpha*0.55, 0.0, 0.9) * vig;
  col = col / max(alpha*1.8, 0.0001);
  gl_FragColor = vec4(clamp(col,0.0,1.0)*alpha, alpha);
}`;

export function ShaderField({
  className,
  levelRef,
  count = 16,
}: {
  className?: string;
  levelRef?: MutableRefObject<number>;
  count?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: true, alpha: true });
    if (!gl) return;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");
    const uLevel = gl.getUniformLocation(prog, "u_level");
    const uCount = gl.getUniformLocation(prog, "u_count");
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    let level = 0;
    let visible = true;
    let raf = 0;
    const t0 = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, r.width * dpr);
      canvas.height = Math.max(1, r.height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) / r.width;
      mouse.ty = 1 - (e.clientY - r.top) / r.height;
    };
    const io = new IntersectionObserver(([en]) => {
      visible = !!en?.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);

    function frame(now: number) {
      raf = 0;
      if (!visible || !gl) return;
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      level += ((levelRef?.current ?? 0) - level) * 0.15;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, canvas!.width, canvas!.height);
      gl.uniform1f(uTime, reduce ? 4 : (now - t0) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uLevel, level);
      gl.uniform1f(uCount, count);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!reduce) raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, [levelRef, count]);

  return <canvas ref={ref} aria-hidden className={cn("pointer-events-none h-full w-full", className)} />;
}
