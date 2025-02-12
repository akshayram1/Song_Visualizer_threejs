import * as THREE from 'three';
import { GUI } from 'dat.gui';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
	45,
	window.innerWidth / window.innerHeight,
	0.1,
	1000
);

const params = {
	red: 1.0,
	green: 1.0,
	blue: 1.0,
	threshold: 0.5,
	strength: 0.19,
	radius: 0.8
};

renderer.outputColorSpace = THREE.SRGBColorSpace;

const renderScene = new RenderPass(scene, camera);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight));
bloomPass.threshold = params.threshold;
bloomPass.strength = params.strength;
bloomPass.radius = params.radius;

const bloomComposer = new EffectComposer(renderer);
bloomComposer.addPass(renderScene);
bloomComposer.addPass(bloomPass);

const outputPass = new OutputPass();
bloomComposer.addPass(outputPass);

camera.position.set(0, -2, 14);
camera.lookAt(0, 0, 0);

const uniforms = {
	u_time: { type: 'f', value: 0.0 },
	u_frequency: { type: 'f', value: 0.0 },
	u_red: { type: 'f', value: 0.0 },
	u_green: { type: 'f', value: 1.0 },
	u_blue: { type: 'f', value: 1.0 }
};

const mat = new THREE.ShaderMaterial({
	uniforms,
	vertexShader: document.getElementById('vertexshader').textContent,
	fragmentShader: document.getElementById('fragmentshader').textContent
});

const geo = new THREE.IcosahedronGeometry(4, 30);
const mesh = new THREE.Mesh(geo, mat);
scene.add(mesh);
mesh.material.wireframe = true;

const listener = new THREE.AudioListener();
camera.add(listener);

const sound = new THREE.Audio(listener);

const playPauseBtn = document.getElementById('playPauseBtn');
const progressBar = document.querySelector('.progress-bar');
const currentTimeSpan = document.querySelector('.current-time');
const durationSpan = document.querySelector('.duration');
let isPlaying = false;

let analyser;

const audioLoader = new THREE.AudioLoader();
audioLoader.load('./assets/Beats.mp3', function (buffer) {
	sound.setBuffer(buffer);
	analyser = new THREE.AudioAnalyser(sound, 32);
	const duration = buffer.duration;
	durationSpan.textContent = formatTime(duration);
	currentTimeSpan.textContent = '0:00';
	progressBar.style.width = '0%';

	playPauseBtn.addEventListener('click', function () {
		if (!isPlaying) {
			// Resume audio context if suspended
			if (sound.context.state === 'suspended') {
				sound.context.resume().then(() => {
					sound.play();
				});
			} else {
				sound.play();
			}
			playPauseBtn.querySelector('i').className = 'fas fa-pause';
		} else {
			sound.pause();
			playPauseBtn.querySelector('i').className = 'fas fa-play';
		}
		isPlaying = !isPlaying;
	});
});

document.querySelector('.progress-container').addEventListener('click', function (e) {
	if (!sound.buffer) return;

	const rect = this.getBoundingClientRect();
	const x = e.clientX - rect.left;
	const width = rect.width;
	const percentage = x / width;
	const newTime = percentage * sound.buffer.duration;

	if (sound.isPlaying) {
		sound.stop();
		sound.offset = newTime;
		sound.play();
	} else {
		sound.offset = newTime;
		progressBar.style.width = `${percentage * 100}%`;
		currentTimeSpan.textContent = formatTime(newTime);
	}
});

function formatTime(seconds) {
	const minutes = Math.floor(seconds / 60);
	seconds = Math.floor(seconds % 60);
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const gui = new GUI();

const colorsFolder = gui.addFolder('Colors');
colorsFolder.add(params, 'red', 0, 1).onChange(function (value) {
	uniforms.u_red.value = Number(value);
});
colorsFolder.add(params, 'green', 0, 1).onChange(function (value) {
	uniforms.u_green.value = Number(value);
});
colorsFolder.add(params, 'blue', 0, 1).onChange(function (value) {
	uniforms.u_blue.value = Number(value);
});

const bloomFolder = gui.addFolder('Bloom');
bloomFolder.add(params, 'threshold', 0, 1).onChange(function (value) {
	bloomPass.threshold = Number(value);
});
bloomFolder.add(params, 'strength', 0, 5).onChange(function (value) {
	bloomPass.strength = Number(value);
});
bloomFolder.add(params, 'radius', 0, 1).onChange(function (value) {
	bloomPass.radius = Number(value);
});

let mouseX = 0;
let mouseY = 0;
document.addEventListener('mousemove', function (e) {
	let windowHalfX = window.innerWidth / 2;
	let windowHalfY = window.innerHeight / 2;
	mouseX = (e.clientX - windowHalfX) / 100;
	mouseY = (e.clientY - windowHalfY) / 100;
});

const clock = new THREE.Clock();
function animate() {
	camera.position.x += (mouseX - camera.position.x) * 0.05;
	camera.position.y += (-mouseY - camera.position.y) * 0.05;
	camera.lookAt(scene.position);
	uniforms.u_time.value = clock.getElapsedTime();

	if (analyser) {
		uniforms.u_frequency.value = analyser.getAverageFrequency() * 3;
	}

	if (sound.isPlaying && sound.buffer) {
		let currentTime;
		if (sound.context.state === 'running') {
			currentTime = (sound.context.currentTime - sound.startTime) % sound.buffer.duration;
			if (currentTime < 0) currentTime = 0;

			const duration = sound.buffer.duration;
			const progress = (currentTime / duration) * 100;

			progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
			currentTimeSpan.textContent = formatTime(currentTime);
		}
	}

	bloomComposer.render();
	requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', function () {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	bloomComposer.setSize(window.innerWidth, window.innerHeight);
});