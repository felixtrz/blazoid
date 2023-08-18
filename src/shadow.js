import {
	CircleGeometry,
	Group,
	Mesh,
	Raycaster,
	ShaderMaterial,
	Vector3,
} from 'three';

export class Shadow extends Group {
	constructor(object, shadowReceivers) {
		super();
		this._shadowReceivers = shadowReceivers;
		const geometry = new CircleGeometry(0.15);
		const material = new ShaderMaterial({
			vertexShader: `
      varying vec2 vUv;

      void main() {
          vUv = uv;
          vec4 modelPosition = modelMatrix * vec4(position, 1.0);
          vec4 viewPosition = viewMatrix * modelPosition;
          vec4 projectedPosition = projectionMatrix * viewPosition;
      
          gl_Position = projectedPosition;
      }
      `,
			fragmentShader: `
      uniform float uAlpha;
      varying vec2 vUv;
      
      void main() {
          gl_FragColor = vec4(vec3(0.33, 0.33, 0.33), clamp((0.5-length(vec2(vUv.x-0.5, vUv.y-0.5)))*uAlpha*3.0, 0.0, 1.0));
      }
      `,
			uniforms: {
				uAlpha: { value: 1.0 },
			},
			transparent: true,
		});
		this._mesh = new Mesh(geometry, material);
		this._mesh.rotateX(-Math.PI / 2);
		this.add(this._mesh);
		this._raycaster = new Raycaster();
		this.frustumCulled = false;
		this._mesh.renderOrder = 999;
		this.object = object;
	}

	updateMatrixWorld(force) {
		super.updateMatrixWorld(force);
		this._raycaster.set(
			this.object.getWorldPosition(new Vector3()),
			new Vector3(0, -1, 0),
		);
		const hit = this._raycaster.intersectObjects(
			this._shadowReceivers,
			true,
		)[0];
		if (hit) {
			this.position.copy(hit.point);
			this.position.y += 0.002;
			const distanceFactor =
				(Math.max(Math.min(hit.distance, 0.35), 0.1) - 0.1) * 4;
			this._mesh.material.uniforms.uAlpha.value = 1 - distanceFactor;
			this._mesh.material.uniformsNeedUpdate = true;
			this._mesh.scale.setScalar(1 - distanceFactor);
		}
	}
}
