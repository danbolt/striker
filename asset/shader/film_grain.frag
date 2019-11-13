precision mediump float;

uniform vec2 resolution;
uniform float time;

// Noise taken from
// https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83

float rand(float n){return fract(sin(n) * 43758.5453123);}

float rand(vec2 n) { 
	return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}
float noise(float p){
	float fl = floor(p);
  	float fc = fract(p);
	return mix(rand(fl), rand(fl + 1.0), fc);
}
	
float noise(vec2 n) {
	const vec2 d = vec2(0.0, 1.0);
  	vec2 b = floor(n), f = smoothstep(vec2(0.0), vec2(1.0), fract(n));
	return mix(mix(rand(b), rand(b + d.yx), f.x), mix(rand(b + d.xy), rand(b + d.yy), f.x), f.y);
}

void main () 
{
	vec2 position = gl_FragCoord.xy * rand(time);
	float noiseVal = noise(position * 0.4 + (rand(time * 0.1)));

	vec2 halfResolution = resolution * 0.5;
	float distanceToCorner = distance(halfResolution, vec2(0.0, 0.0));
	float distanceToCenter = distance(gl_FragCoord.xy, halfResolution);
	float noiseVolume = distanceToCenter / distanceToCorner * 0.06;

    gl_FragColor = (vec4(noiseVal, noiseVal, noiseVal, 0.15) * noiseVolume) + 0.0312;
}
