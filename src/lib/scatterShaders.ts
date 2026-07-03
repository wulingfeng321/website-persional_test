export const SCATTER_VERTEX = /* glsl */ `
  attribute vec3 posFrom;
  attribute vec3 scatterPos;
  attribute vec3 pointData;     // x=size, y=delay, z=random

  uniform float progress;       // 0→1: from→scatter→target
  uniform float pointSizeScale;
  uniform float cameraFadeStart;
  uniform float cameraFadeDistance;

  varying float vAlpha;
  varying vec3 vColor;
  varying float vDistanceAlpha;

  float easeIn(float t)  { return t * t * t; }
  float easeOut(float t) { float u = 1.0 - t; return 1.0 - u * u * u; }

  void main() {
    float size  = pointData.x;
    float delay = pointData.y;

    float stagger = 0.3;
    float p = clamp((progress - delay * stagger) / (1.0 - stagger), 0.0, 1.0);

    vec3 pos;
    float alpha;

    if (p <= 0.5) {
      float t = easeIn(p * 2.0);
      pos = mix(posFrom, scatterPos, t);
      alpha = mix(0.7, 0.15, t);
    } else {
      float t = easeOut((p - 0.5) * 2.0);
      pos = mix(scatterPos, position, t);
      alpha = mix(0.15, 0.7, t);
    }

    // Warm color shift at peak scatter
    float scatterAmount = 1.0 - abs(p - 0.5) * 2.0;
    vColor = mix(color, vec3(1.0, 0.95, 0.5), scatterAmount * 0.3);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float viewZ = -mvPosition.z;
    float distanceAlpha = 1.0 - clamp(
      (viewZ - cameraFadeStart) / (cameraFadeDistance - cameraFadeStart),
      0.0, 1.0
    );
    vAlpha = alpha * distanceAlpha;
    vDistanceAlpha = distanceAlpha;

    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = size * pointSizeScale * distanceAlpha + 1.0;
  }
`;

export const SCATTER_FRAGMENT = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  varying float vDistanceAlpha;

  uniform float coreRadius;
  uniform float innerGlowStrength;
  uniform float compressStrength;

  void main() {
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    float alpha = vAlpha;
    if (dist > coreRadius * vDistanceAlpha) {
      float fadeOut = smoothstep(0.5, coreRadius, dist);
      float distanceFade = 1.0 - pow(dist / 0.5, 2.0);
      alpha = vAlpha * fadeOut * distanceFade;
    }

    float innerGlow = 1.0 - smoothstep(0.0, coreRadius * 3.0, dist);
    vec3 finalColor = vColor + vColor * innerGlow * innerGlowStrength;
    vec3 compressed = finalColor / (finalColor + vec3(1.0));
    finalColor = mix(finalColor, compressed, compressStrength);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;
