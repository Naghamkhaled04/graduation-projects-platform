import * as THREE from 'three';

/**
 * مادة ناطحات ليلية: النوافذ تُولَّد بالشيدر من إحداثيات العالم،
 * فتعمل على أي حجم مبنى وبدون صور، وتشتغل مع InstancedMesh أيضاً.
 */
export function windowMaterial(o: { base?: number; tint?: number | string; seed?: number; glow?: number; lit?: number } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: o.base ?? 0x10282b, roughness: 0.85, metalness: 0.15 });
  const u = {
    uTint: { value: new THREE.Color(o.tint ?? 0xffb060) },
    uSeed: { value: o.seed ?? 1 },
    uGlow: { value: o.glow ?? 2.2 },
    uLit: { value: o.lit ?? 0.42 },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWN;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 wp = vec4(transformed, 1.0);
        vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
          wn = mat3(instanceMatrix) * wn;
        #endif
        wp = modelMatrix * wp;
        vWPos = wp.xyz;
        vWN = normalize(mat3(modelMatrix) * wn);`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWPos;
        varying vec3 vWN;
        uniform vec3 uTint;
        uniform float uSeed;
        uniform float uGlow;
        uniform float uLit;
        float hh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 an = abs(vWN);
          float vertical = 1.0 - step(0.6, an.y);
          bool alongX = an.x > an.z;
          vec2 uvw = alongX ? vec2(vWPos.z, vWPos.y) : vec2(vWPos.x, vWPos.y);
          vec2 g = vec2(uvw.x / 1.7, uvw.y / 2.6);
          vec2 cid = floor(g);
          vec2 f = fract(g);
          float win = step(0.16, f.x) * (1.0 - step(0.84, f.x)) * step(0.2, f.y) * (1.0 - step(0.8, f.y));
          float r = hh(cid + uSeed + (alongX ? 17.0 : 0.0));
          float on = step(uLit, r);
          float k = hh(cid * 1.7 + uSeed + 3.0);
          vec3 wc = mix(vec3(1.0, 0.66, 0.3), vec3(1.0, 0.92, 0.78), k);
          wc = mix(wc, uTint, 0.5 * step(0.82, k));
          totalEmissiveRadiance += wc * win * on * vertical * uGlow;
        }`,
      );
  };
  m.customProgramCacheKey = () => 'cityWindow';
  return m;
}
