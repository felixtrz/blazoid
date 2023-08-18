/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BackSide, IcosahedronGeometry, Mesh, Vector3 } from 'three';
import { coreGeometries, matCapMaterials } from './screen';

import { ARButton } from './ARButton';
import { GlobalComponent } from './global';
import { System } from '@lastolivegames/becsy';

const CAMERA_START_POSITION = new Vector3(0, 0.1, 0.4);
const CAMERA_ROATION_AXIS = new Vector3(0, 1, 0);
const CAMERA_ROTATION_FREQUENCY = 0.05;

export class InlineSystem extends System {
	constructor() {
		super();
		this.globalEntity = this.query((q) => q.current.with(GlobalComponent));
		this.needsSetup = true;
	}

	_loadModel(global) {
		const { camera, scene } = global;
		const containerMaterial = matCapMaterials[
			Math.floor(Math.random() * matCapMaterials.length)
		].clone();
		containerMaterial.side = BackSide;
		this.container = new Mesh(new IcosahedronGeometry(1, 0), containerMaterial);
		this.core = new Mesh(
			coreGeometries[Math.floor(Math.random() * coreGeometries.length)],
			matCapMaterials[Math.floor(Math.random() * matCapMaterials.length)],
		);
		scene.add(this.container.add(this.core));
		camera.position.set(0, 0.1, 0.4);
		this.wasPresenting = false;
	}

	_setupButtons(global) {
		const arButton = document.getElementById('ar-button');
		const webLaunchButton = document.getElementById('web-launch-button');
		webLaunchButton.style.display = 'none';
		ARButton.convertToARButton(arButton, global.renderer, {
			sessionInit: {
				requiredFeatures: [
					'hit-test',
					'plane-detection',
					'anchors',
					'mesh-detection',
					'hand-tracking',
				],
				optionalFeatures: ['local-floor', 'bounded-floor', 'layers'],
			},
			onUnsupported: () => {
				arButton.style.display = 'none';
				webLaunchButton.style.display = 'block';
			},
		});
		webLaunchButton.onclick = () => {
			window.open(
				'https://www.oculus.com/open_url/?url=' +
					encodeURIComponent(window.location.href),
			);
		};
	}

	execute() {
		const global = this.globalEntity.current[0].read(GlobalComponent);

		const { camera } = global;

		const isPresenting = global.renderer.xr.isPresenting;
		if (!isPresenting) {
			camera.position
				.copy(CAMERA_START_POSITION)
				.applyAxisAngle(
					CAMERA_ROATION_AXIS,
					this.time * CAMERA_ROTATION_FREQUENCY,
				);
			camera.lookAt(0, 0, 0);
		}

		if (this.needsSetup) {
			this._loadModel(global);
			this._setupButtons(global);
			this.needsSetup = false;
			return;
		}

		if (!this.wasPresenting && isPresenting) {
			this.container.visible = false;
			global.scene.traverse((object) => {
				if (object.userData.arOnly) {
					object.visible = true;
				}
			});
		} else if (this.wasPresenting && !isPresenting) {
			this.container.visible = true;
			global.camera.position.set(0, 0.1, 0.4);
			global.scene.traverse((object) => {
				if (object.userData.arOnly) {
					object.visible = false;
				}
			});
		}

		this.wasPresenting = isPresenting;
	}
}
