import {Matrix4} from '../vendor/three.module.min.js';
export function createMenuRenderer(gl,menu){
  const program=gl.createProgram();
  for(const [type,src] of [[gl.VERTEX_SHADER,`#version 300 es
    uniform mat4 mvp;out vec2 uv;
    void main(){vec2 p=vec2(float(gl_VertexID&1),float(gl_VertexID>>1));uv=vec2(p.x,1.-p.y);gl_Position=mvp*vec4(p-.5,0.,1.);}`],
    [gl.FRAGMENT_SHADER,`#version 300 es
    precision mediump float;uniform sampler2D panel;in vec2 uv;out vec4 color;
    void main(){color=texture(panel,uv);if(color.a<.5)discard;}`]]){
    const shader=gl.createShader(type);gl.shaderSource(shader,src);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program,shader);gl.deleteShader(shader);
  }
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  const texture=gl.createTexture(),vao=gl.createVertexArray(),loc=gl.getUniformLocation(program,'mvp');
  const proj=new Matrix4(),viewM=new Matrix4();let version=-1;
  return function draw(view,sceneProgram){
    if(!menu.visible)return;
    gl.useProgram(program);gl.bindVertexArray(vao);gl.bindTexture(gl.TEXTURE_2D,texture);
    if(version!==menu.version){
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,menu.canvas);version=menu.version;
    }
    proj.fromArray(view.projectionMatrix).multiply(viewM.fromArray(view.transform.inverse.matrix)).multiply(menu.matrix);
    gl.uniformMatrix4fv(loc,false,proj.elements);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.bindVertexArray(null);gl.useProgram(sceneProgram);
  };
}
