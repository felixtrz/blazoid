import {
	BackSide,
	DodecahedronGeometry,
	Group,
	IcosahedronGeometry,
	Mesh,
	MeshMatcapMaterial,
	PlaneGeometry,
	Raycaster,
	ShaderMaterial,
	TextureLoader,
	TorusKnotGeometry,
	Vector3,
} from 'three';

import { Flame } from './flame';
import { GlobalComponent } from './global';
import { Shadow } from './shadow';
import { System } from '@lastolivegames/becsy';

const almostEqual = (a, b) => {
	return Math.abs(a - b) < 0.00001;
};

const CUBE_FACES = {
	Left: 'left',
	Right: 'right',
	Top: 'top',
	Bottom: 'bottom',
	Front: 'front',
	Back: 'back',
};

const textureLoader = new TextureLoader();
const maskMaterial = new ShaderMaterial({
	vertexShader: `
  void main() {
      vec4 modelPosition = modelMatrix * vec4(position, 1.0);
      vec4 viewPosition = viewMatrix * modelPosition;
      vec4 projectedPosition = projectionMatrix * viewPosition;
  
      gl_Position = projectedPosition;
  }
  `,
	fragmentShader: `
  void main() {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
  }
  `,
	side: BackSide,
});

export const coreGeometries = [
	new IcosahedronGeometry(0.1, 0),
	new TorusKnotGeometry(0.05, 0.03, 100, 16),
	new DodecahedronGeometry(0.1, 0),
];

export const matCapMaterials = [
	new MeshMatcapMaterial({
		matcap: textureLoader.load('assets/matcap1.jpg'),
	}),
	new MeshMatcapMaterial({
		matcap: textureLoader.load('assets/matcap2.jpg'),
	}),
	new MeshMatcapMaterial({
		matcap: textureLoader.load('assets/matcap3.jpg'),
	}),
	new MeshMatcapMaterial({
		matcap: textureLoader.load('assets/matcap4.jpg'),
	}),
	new MeshMatcapMaterial({
		matcap: textureLoader.load('assets/matcap5.jpg'),
	}),
	new MeshMatcapMaterial({
		matcap: textureLoader.load('assets/matcap6.jpg'),
	}),
];

export class ScreenSystem extends System {
	constructor() {
		super();
		this.globalEntity = this.query((q) => q.current.with(GlobalComponent));
		this._raycaster = new Raycaster();
		this._vec3 = new Vector3();

		this._boxes = [];
		this._cores = [];
	}

	execute() {
		const global = this.globalEntity.current[0].read(GlobalComponent);

		const { renderer, ratk, scene } = global;

		for (let i = 0; i < 2; i++) {
			const targetRaySpace = renderer.xr.getController(i);
			this._raycaster.set(
				targetRaySpace.position,
				targetRaySpace.getWorldDirection(this._vec3).negate(),
			);

			targetRaySpace.userData.hit = this._raycaster.intersectObjects(
				Array.from(ratk.meshes).map((mesh) => mesh.meshMesh),
				false,
			)[0];

			if (!targetRaySpace.userData?.ready) {
				targetRaySpace.addEventListener('selectstart', () => {
					const hit = targetRaySpace.userData.hit;
					if (hit && hit.object.userData.box) {
						const core = hit.object.userData.box.userData.core;
						core.userData.target = targetRaySpace;
						targetRaySpace.userData.core = core;
					}
				});

				targetRaySpace.addEventListener('selectend', () => {
					const core = targetRaySpace.userData.core;
					if (core) {
						const box = core.userData.box;
						box.userData.generateCore();
						core.userData.target = core.userData.shadow;
						core.userData.destructing = true;
						targetRaySpace.userData.core = null;
					} else {
						const hit = targetRaySpace.userData.hit;
						if (
							hit &&
							hit.object.parent.semanticLabel === 'screen' &&
							!hit.object.userData.box
						) {
							this.createBoxFromHit(hit);
						}
					}
				});

				targetRaySpace.userData.ready = true;
			}
		}

		this._cores.forEach((core) => {
			if (!core.visible) return;
			core.rotateOnAxis(core.userData.rotationAxis, this.delta);

			const target = core.userData.target;
			const destructing = core.userData.destructing;
			if (target) {
				if (core.parent != scene) {
					scene.attach(core);
				}
				core.position.lerp(target.position, this.delta * (destructing ? 3 : 1));
				if (destructing && core.position.distanceTo(target.position) < 0.05) {
					core.visible = false;
					const flame = new Flame();
					scene.add(flame);
					flame.position.copy(target.position);
					let flameStrength = 0.3;
					flame.setStrength(flameStrength);
					const jobId = setInterval(() => {
						flameStrength *= 0.9;
						flame.setStrength(flameStrength);
						if (flameStrength < 0.15) {
							clearInterval(jobId);
						}
					}, 20);
				}
			} else {
				core.userData.box.attach(core);
				core.position.lerp(core.userData.position, this.delta * 2);
			}
		});
	}

	createBoxFromHit(hit) {
		const mesh = hit.object;
		const faceVertexIndices = [hit.face.a, hit.face.b, hit.face.c];
		const positionAttribute = mesh.geometry.getAttribute('position');
		const faceVertices = faceVertexIndices.map((vertexIndex) => {
			const vertex = new Vector3(
				positionAttribute.getX(vertexIndex),
				positionAttribute.getY(vertexIndex),
				positionAttribute.getZ(vertexIndex),
			);
			return vertex;
		});
		let face;
		let [minX, minY, minZ] = faceVertices[0].toArray();
		let [maxX, maxY, maxZ] = faceVertices[0].toArray();
		faceVertices.forEach((vertex) => {
			minX = Math.min(vertex.x, minX);
			minY = Math.min(vertex.y, minY);
			minZ = Math.min(vertex.z, minZ);
			maxX = Math.max(vertex.x, maxX);
			maxY = Math.max(vertex.y, maxY);
			maxZ = Math.max(vertex.z, maxZ);
		});
		if (almostEqual(minX, maxX)) {
			if (minX < 0) {
				face = CUBE_FACES.Left;
			} else {
				face = CUBE_FACES.Right;
			}
		} else if (almostEqual(minY, maxY)) {
			if (minY < 0) {
				face = CUBE_FACES.Bottom;
			} else {
				face = CUBE_FACES.Top;
			}
		} else if (almostEqual(minZ, maxZ)) {
			if (minZ < 0) {
				face = CUBE_FACES.Back;
			} else {
				face = CUBE_FACES.Front;
			}
		}

		let plane;
		let box;

		if (face === CUBE_FACES.Front || face === CUBE_FACES.Back) {
			plane = new Mesh(new PlaneGeometry(maxX - minX, maxY - minY));
			box = this.createBox(maxX - minX, maxY - minY);
		} else if (face === CUBE_FACES.Left || face === CUBE_FACES.Right) {
			plane = new Mesh(new PlaneGeometry(maxZ - minZ, maxY - minY));
			plane.rotateY(face === CUBE_FACES.Left ? -Math.PI / 2 : Math.PI / 2);
			box = this.createBox(maxZ - minZ, maxY - minY);
			box.rotateY(face === CUBE_FACES.Left ? -Math.PI / 2 : Math.PI / 2);
		} else if (face === CUBE_FACES.Top || face === CUBE_FACES.Bottom) {
			plane = new Mesh(new PlaneGeometry(maxX - minX, maxZ - minZ));
			plane.rotateX(face === CUBE_FACES.Top ? -Math.PI / 2 : Math.PI / 2);
			box = this.createBox(maxX - minX, maxZ - minZ);
			box.rotateX(face === CUBE_FACES.Top ? -Math.PI / 2 : Math.PI / 2);
		}

		// if (plane) {
		// 	plane.position.set((maxX + minX) / 2, (maxY + minY) / 2, (maxZ + minZ) / 2);
		// 	console.log(plane);
		// 	hit.object.parent.add(plane);
		// }

		if (box) {
			box.position.set((maxX + minX) / 2, (maxY + minY) / 2, (maxZ + minZ) / 2);
			hit.object.parent.add(box);
			hit.object.userData.box = box;
		}
	}

	createBox(containerWidth, containerHeight) {
		const width = containerWidth - 0.02;
		const height = containerHeight - 0.02;
		const box = new Group();
		const boxMaterial =
			matCapMaterials[Math.floor(Math.random() * matCapMaterials.length)];

		const planeZGeometry = new PlaneGeometry(width, height);

		const planez = new Mesh(planeZGeometry, boxMaterial);
		planez.position.z = -0.4;
		const planezMask = new Mesh(planeZGeometry, maskMaterial);
		planezMask.position.copy(planez.position);

		const planeXGeometry = new PlaneGeometry(0.4, height);

		const planex1 = new Mesh(planeXGeometry, boxMaterial);
		planex1.position.set(-width / 2, 0, -0.2);
		planex1.rotateY(Math.PI / 2);
		const planex1Mask = new Mesh(planeXGeometry, maskMaterial);
		planex1Mask.position.copy(planex1.position);
		planex1Mask.quaternion.copy(planex1.quaternion);

		const planex2 = new Mesh(planeXGeometry, boxMaterial);
		planex2.position.set(width / 2, 0, -0.2);
		planex2.rotateY(-Math.PI / 2);
		const planex2Mask = new Mesh(planeXGeometry, maskMaterial);
		planex2Mask.position.copy(planex2.position);
		planex2Mask.quaternion.copy(planex2.quaternion);

		const planeYGeometry = new PlaneGeometry(width, 0.4);

		const planey1 = new Mesh(planeYGeometry, boxMaterial);
		planey1.position.set(0, height / 2, -0.2);
		planey1.rotateX(Math.PI / 2);
		const planey1Mask = new Mesh(planeYGeometry, maskMaterial);
		planey1Mask.position.copy(planey1.position);
		planey1Mask.quaternion.copy(planey1.quaternion);

		const planey2 = new Mesh(planeYGeometry, boxMaterial);
		planey2.position.set(0, -height / 2, -0.2);
		planey2.rotateX(-Math.PI / 2);
		const planey2Mask = new Mesh(planeYGeometry, maskMaterial);
		planey2Mask.position.copy(planey2.position);
		planey2Mask.quaternion.copy(planey2.quaternion);

		box.add(
			planez,
			planezMask,
			planex1,
			planex2,
			planey1,
			planey2,
			planex1Mask,
			planex2Mask,
			planey1Mask,
			planey2Mask,
		);

		box.userData.generateCore = () => {
			const core = new Mesh(
				coreGeometries[Math.floor(Math.random() * coreGeometries.length)],
				matCapMaterials[Math.floor(Math.random() * matCapMaterials.length)],
			);
			box.add(core);
			const rotationAxis = new Vector3(
				Math.random(),
				Math.random(),
				Math.random(),
			).normalize();

			core.position.z = -0.2;

			const global = this.globalEntity.current[0].read(GlobalComponent);

			const { ratk, scene } = global;

			const shadow = new Shadow(core, Array.from(ratk.planes));
			scene.add(shadow);

			core.userData = {
				shadow,
				box,
				rotationAxis,
				position: core.position.clone(),
			};
			this._cores.push(core);

			box.userData.core = core;
		};

		box.userData.generateCore();
		this._boxes.push(box);
		return box;
	}
}
