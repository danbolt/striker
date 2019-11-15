precision mediump float;

uniform vec2 resolution;
uniform float time;

void main () 
{
	float intensity = 0.025;
	float scanlineVal = (sin(gl_FragCoord.y) * intensity) + intensity * 0.5;

    gl_FragColor = vec4(0.0, 0.0, 0.0, scanlineVal);
}
