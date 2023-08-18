/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import './styles/index.css';

import { DoubleSide, MeshBasicMaterial } from 'three';
import { PlayerComponent, PlayerSystem } from './player';
import { SpinComponent, SpinSystem } from './spin';

import { GlobalComponent } from './global';
import { InlineSystem } from './landing';
import { RealityAccelerator } from 'ratk';
import { ScreenSystem } from './screen';
import { World } from '@lastolivegames/becsy';
import { setupScene } from './scene';

const worldDef = {
	defs: [
		GlobalComponent,
		PlayerComponent,
		PlayerSystem,
		ScreenSystem,
		// SpawnSystem,
		SpinComponent,
		SpinSystem,
		InlineSystem,
	],
};

World.create(worldDef).then((world) => {
	let ecsexecuting = false;
	const { scene, camera, renderer } = setupScene();
	const ratk = new RealityAccelerator(renderer.xr);
	ratk.onPlaneAdded = (plane) => {
		const mesh = plane.planeMesh;
		mesh.material = new MeshBasicMaterial({
			wireframe: true,
			side: DoubleSide,
		});
		mesh.visible = false;
	};
	ratk.onMeshAdded = (mesh) => {
		console.log(mesh, mesh.semanticLabel);
		const meshMesh = mesh.meshMesh;
		if (mesh.semanticLabel === 'screen') {
			meshMesh.visible = false;
			meshMesh.material = new MeshBasicMaterial({
				side: DoubleSide,
			});
		} else {
			meshMesh.material = new MeshBasicMaterial({
				wireframe: true,
			});
			meshMesh.visible = false;
		}
	};
	scene.add(ratk.root);

	world.createEntity(GlobalComponent, { renderer, camera, scene, ratk });

	let roomCaptureDelayTimer = null;
	let roomCaptureDone = false;
	renderer.setAnimationLoop(function () {
		if (renderer.xr.isPresenting && !roomCaptureDone) {
			if (roomCaptureDelayTimer == null) {
				roomCaptureDelayTimer = performance.now();
			} else if (performance.now() - roomCaptureDelayTimer > 2000) {
				if (ratk.planes.size == 0) {
					renderer.xr.getSession().initiateRoomCapture();
				}
				roomCaptureDone = true;
			}
		}

		// boxes.forEach((box) => {
		// 	const knot = box.userData.knot;
		// 	const target = knot.userData.target;
		// 	if (target) {
		// 		if (knot.parent != scene) {
		// 			scene.attach(knot);
		// 		}
		// 		knot.position.lerp(target.position, 0.016 * 1);
		// 	} else {
		// 		knot.userData.box.attach(knot);
		// 		knot.position.lerp(knot.userData.position, 0.016 * 2);
		// 	}
		// });

		ratk.update();
		renderer.render(scene, camera);
		if (ecsexecuting == false) {
			ecsexecuting = true;
			world.execute().then(() => {
				ecsexecuting = false;
			});
		}
	});
});
