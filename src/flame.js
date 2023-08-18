import * as THREE from 'three';

const LIFE_CYCLE = 1000;
const NUM_PARTICLES = 10;

const flameParticleMaterial = new THREE.MeshMatcapMaterial({
	matcap: new THREE.TextureLoader().load('./assets/flame_matcap.png'),
	color: 0xffffff,
});

export class Flame extends THREE.Group {
	constructor() {
		super();
		const flameParticleGeometry = new THREE.IcosahedronGeometry(0.4);
		this._flameInstancedMesh = new THREE.InstancedMesh(
			flameParticleGeometry,
			flameParticleMaterial,
			NUM_PARTICLES,
		);
		this.add(this._flameInstancedMesh);

		const initDummy = new THREE.Object3D();
		initDummy.scale.setScalar(0);
		initDummy.updateMatrix();

		this._particles = [];
		for (let i = 0; i < NUM_PARTICLES; i++) {
			this._flameInstancedMesh.setMatrixAt(i, initDummy.matrix);
			setTimeout(() => {
				const dummy = new THREE.Object3D();
				this._particles.push({
					dummy: dummy,
					time: performance.now(),
					alpha: 1,
					strengthMultiplier: 1,
				});
			}, i * 100);
		}

		this._strengthMultiplier = 1;
	}

	updateMatrixWorld(force) {
		super.updateMatrixWorld(force);

		this._particles.forEach((particleData, i) => {
			const { dummy, time } = particleData;
			const alpha = ((performance.now() - time) % LIFE_CYCLE) / LIFE_CYCLE;
			if (alpha < particleData.alpha) {
				particleData.direction = new THREE.Vector3(
					Math.random() - 0.5,
					2,
					Math.random() - 0.5,
				).normalize();
				particleData.speed = Math.random() * 1 + 1;
				particleData.angularSpeed = Math.random() * 2;
				particleData.strengthMultiplier = this._strengthMultiplier;
			}
			const {
				direction,
				speed,
				angularSpeed,
				strengthMultiplier,
			} = particleData;

			dummy.scale.setScalar(Math.sin(alpha * Math.PI) * strengthMultiplier);

			dummy.position
				.copy(direction)
				.multiplyScalar(alpha * speed * strengthMultiplier);
			dummy.rotation.y = alpha * angularSpeed;
			particleData.alpha = alpha;
			dummy.updateMatrix();
			this._flameInstancedMesh.setMatrixAt(i, dummy.matrix);
			this._flameInstancedMesh.setColorAt(
				i,
				new THREE.Color(0xffff00).lerp(new THREE.Color(0xff0000), alpha),
			);
		});
		this._flameInstancedMesh.material.needsUpdate = true;
		this._flameInstancedMesh.instanceMatrix.needsUpdate = true;
		if (this._flameInstancedMesh.instanceColor) {
			this._flameInstancedMesh.instanceColor.needsUpdate = true;
		}
	}

	setStrength(strength) {
		this._strengthMultiplier = strength;
	}
}
