import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const VIDEO_URL = "SOLOERROR.webm";
const MODEL_URL = "mesa.glb";

let renderer, scene, camera;
let modelRoot;

let targetRotationY = 0;
let currentRotationY = 0;

const MAX_ROT = Math.PI * 0.35;
const BASE_MODEL_SCALE = 0.8;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let clickableScreens = [];

let zooming = false;
let zoomed = false;
const initialCamPos = new THREE.Vector3();
const initialCamQuat = new THREE.Quaternion();

let videoEl = null;

initVideo();
initThree();
loadModel();
animate();

function isMobileViewport() {
  return window.matchMedia("(max-width: 1000px)").matches;
}

function applyResponsiveScale() {
  if (!modelRoot) return;
  const s = isMobileViewport() ? BASE_MODEL_SCALE * 0.5 : BASE_MODEL_SCALE;
  modelRoot.scale.set(s, s, s);
}

function initVideo() {
  videoEl = document.getElementById("videoOverlay");
  if (!VIDEO_URL || !videoEl) return;

  videoEl.src = VIDEO_URL;
  const playPromise = videoEl.play();
  if (playPromise && playPromise.catch) {
    playPromise.catch(() => {});
  }
}

function initThree() {
  const container = document.getElementById("threeContainer");
  const width = container.clientWidth;
  const height = container.clientHeight;

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
  camera.position.set(0, 2, 6);
  camera.lookAt(0, 1, 0);

  window.addEventListener("resize", onWindowResize);
  window.addEventListener("mousemove", onMouseMove);
  renderer.domElement.addEventListener("mousemove", onPointerHover);

  renderer.domElement.addEventListener("pointerdown", onClickTV01);
  renderer.domElement.addEventListener("pointerdown", onClickTV02);
  renderer.domElement.addEventListener("pointerdown", onClickTV03);
  renderer.domElement.addEventListener("pointerdown", onClickTV04);
  renderer.domElement.addEventListener("pointerdown", onClickTV05);
  renderer.domElement.addEventListener("pointerdown", onClickTV06);
  renderer.domElement.addEventListener("pointerdown", onClickTV07);
  renderer.domElement.addEventListener("pointerdown", onClickTV08);
}

function loadModel() {
  const loader = new GLTFLoader();

  loader.load(
    MODEL_URL,
    (gltf) => {
      modelRoot = gltf.scene;
      scene.add(modelRoot);
      applyResponsiveScale();
      modelRoot.position.y = -0.3;

      if (camera && camera.position) {
        camera.position.multiplyScalar(1.2);
      }

      modelRoot.traverse((child) => {
        if (
          child.isMesh &&
          typeof child.name === "string" &&
          child.name.startsWith("TV_") &&
          child.name.endsWith("_SCREEN-Mat")
        ) {
          clickableScreens.push(child);
        }
      });

      const redTopLight = new THREE.DirectionalLight(0xff0000, 10.5);
      redTopLight.position.set(0, 5, 0);
      redTopLight.target.position.set(0, 0, 0);
      scene.add(redTopLight);
      scene.add(redTopLight.target);

      const redLight = new THREE.DirectionalLight(0xd13100, 2.9);
      redLight.position.set(3, 2, 4);
      redLight.target.position.set(0, 1, 0);
      scene.add(redLight);
      scene.add(redLight.target);

      const orangeLight = new THREE.DirectionalLight(0xd13100, 4.9);
      orangeLight.position.set(-3, 2, 4);
      orangeLight.target.position.set(0, 1, 0);
      scene.add(orangeLight);
      scene.add(orangeLight.target);

      const bottomLight = new THREE.DirectionalLight(0xffffff, 7.7);
      bottomLight.position.set(0, -3, 0);
      bottomLight.target.position.set(0, 0, 0);
      scene.add(bottomLight);
      scene.add(bottomLight.target);

      let lightCount = 0;
      gltf.scene.traverse((obj) => {
        if (obj.isLight) lightCount++;
      });

      if (lightCount === 0) {
        const ambient = new THREE.AmbientLight(0xffffff, 1.8);
        scene.add(ambient);
        const dir = new THREE.DirectionalLight(0xffffff, 1.8);
        dir.position.set(5, 10, 7);
        scene.add(dir);
      }

      let glbCamera = null;

      if (gltf.cameras && gltf.cameras.length > 0) {
        glbCamera = gltf.cameras[0];
      }

      if (!glbCamera) {
        gltf.scene.traverse((obj) => {
          if (obj.isCamera && !glbCamera) {
            glbCamera = obj;
          }
        });
      }

      if (glbCamera) {
        camera = glbCamera;

        const container = document.getElementById("threeContainer");
        const width = container.clientWidth;
        const height = container.clientHeight;

        if (camera.isPerspectiveCamera) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        }
      } else {
        frameObject(modelRoot);
      }
    },
    undefined,
    (err) => {
      console.error("Error cargando modelo:", err);
    }
  );
}

function onPointerHover(event) {
  if (!modelRoot || clickableScreens.length === 0) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(clickableScreens, true);

  if (intersects.length > 0) {
    document.body.style.cursor = "pointer";
  } else {
    document.body.style.cursor = "default";
  }
}

function onMouseMove(e) {
  if (zooming || zoomed) return;
  const xNorm = (e.clientX / window.innerWidth) * 2 - 1;
  targetRotationY = xNorm * MAX_ROT;
}

function frameObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  let cameraZ = maxDim / (2 * Math.tan(fov / 2));
  cameraZ *= 1.5;

  camera.position.set(center.x, center.y + maxDim * 0.2, cameraZ);
  camera.lookAt(center);
}

function animate() {
  requestAnimationFrame(animate);

  if (modelRoot && !zooming && !zoomed) {
    currentRotationY += (targetRotationY - currentRotationY) * 0.05;
    modelRoot.rotation.y = currentRotationY;
  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  const container = document.getElementById("threeContainer");
  const width = container.clientWidth;
  const height = container.clientHeight;

  if (camera.isPerspectiveCamera) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  renderer.setSize(width, height);

  applyResponsiveScale();
}

const boostLight = new THREE.SpotLight(0xffffff, 4.5);
boostLight.position.set(0, -2.5, 0);
boostLight.angle = Math.PI * 0.45;
boostLight.penumbra = 1;
boostLight.decay = 1;
boostLight.distance = 20;
boostLight.target.position.set(0, 0, 0);
boostLight.castShadow = true;
boostLight.shadow.mapSize.width = 1024;
boostLight.shadow.mapSize.height = 1024;
boostLight.shadow.bias = -0.0005;
scene.add(boostLight);
scene.add(boostLight.target);

function raycastTV(event, tvName) {
  if (!modelRoot || zooming || zoomed) return null;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const tvMesh = clickableScreens.find((m) => m.name === tvName);
  if (!tvMesh) return null;

  const hits = raycaster.intersectObject(tvMesh, true);
  if (hits.length === 0) return null;

  return tvMesh;
}

function onClickTV01(event) {
  const tv = raycastTV(event, "TV_01_SCREEN-Mat");
  if (!tv) return;
  zoomToTV01(tv);
}

function zoomToTVBase(screenMesh, videoSrc) {
  zooming = true;

  if (videoEl) {
    videoEl.style.display = "none";
    videoEl.pause();
  }

  initialCamPos.copy(camera.position);
  initialCamQuat.copy(camera.quaternion);

  const screenPos = new THREE.Vector3();
  screenMesh.getWorldPosition(screenPos);

  const dir = screenPos.clone().sub(camera.position).normalize();
  const zoomDistance = 0.9;
  const finalCamPos = screenPos.clone().sub(dir.multiplyScalar(zoomDistance));

  const finalCamQuat = new THREE.Quaternion();
  const lookMatrix = new THREE.Matrix4();
  lookMatrix.lookAt(finalCamPos, screenPos, new THREE.Vector3(0, 1, 0));
  finalCamQuat.setFromRotationMatrix(lookMatrix);

  const duration = 1000;
  const start = performance.now();

  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    camera.position.lerpVectors(initialCamPos, finalCamPos, ease);
    camera.quaternion.slerpQuaternions(initialCamQuat, finalCamQuat, ease);

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      zooming = false;
      zoomed = true;

      if (modelRoot) modelRoot.visible = false;
      scene.background = new THREE.Color(0x000000);

      if (videoEl) {
        videoEl.src = videoSrc;
        videoEl.style.display = "block";
        videoEl.style.position = "fixed";
        videoEl.style.left = "0";
        videoEl.style.top = "0";
        videoEl.style.width = "100%";
        videoEl.style.height = "100%";
        videoEl.style.transform = "none";
        videoEl.style.marginTop = "0";
        videoEl.style.zIndex = "2";
        videoEl.style.objectFit = "cover";
        videoEl.style.pointerEvents = "auto";

        const p = videoEl.play();
        if (p && p.catch) {
          p.catch(() => {});
        }

        videoEl.onclick = handleVideoClickBack;
      }
    }
  }

  requestAnimationFrame(step);
}

function zoomToTV01(screenMesh) {
  zoomToTVBase(screenMesh, "VENUS.webm");
}

function onClickTV02(event) {
  const tv = raycastTV(event, "TV_02_SCREEN-Mat");
  if (!tv) return;
  zoomToTV02(tv);
}

function zoomToTV02(screenMesh) {
  zoomToTVBase(screenMesh, "NEPTUNO.webm");
}

function onClickTV03(event) {
  const tv = raycastTV(event, "TV_03_SCREEN-Mat");
  if (!tv) return;
  zoomToTV03(tv);
}

function zoomToTV03(screenMesh) {
  zoomToTVBase(screenMesh, "JUPITER.webm");
}

function onClickTV04(event) {
  const tv = raycastTV(event, "TV_04_SCREEN-Mat");
  if (!tv) return;
  zoomToTV04(tv);
}

function zoomToTV04(screenMesh) {
  zoomToTVBase(screenMesh, "MARTE.webm");
}

function onClickTV05(event) {
  const tv = raycastTV(event, "TV_05_SCREEN-Mat");
  if (!tv) return;
  zoomToTV05(tv);
}

function zoomToTV05(screenMesh) {
  zoomToTVBase(screenMesh, "MERCURIO.webm");
}

function onClickTV06(event) {
  const tv = raycastTV(event, "TV_06_SCREEN-Mat");
  if (!tv) return;
  zoomToTV06(tv);
}

function zoomToTV06(screenMesh) {
  zoomToTVBase(screenMesh, "URANO.webm");
}

function onClickTV07(event) {
  const tv = raycastTV(event, "TV_07_SCREEN-Mat");
  if (!tv) return;
  zoomToTV07(tv);
}

function zoomToTV07(screenMesh) {
  zoomToTVBase(screenMesh, "SATURNO.webm");
}

function onClickTV08(event) {
  const tv = raycastTV(event, "TV_08_SCREEN-Mat");
  if (!tv) return;
  zoomToTV08(tv);
}

function zoomToTV08(screenMesh) {
  zoomToTVBase(screenMesh, "TIERRA.webm");
}

function handleVideoClickBack() {
  if (!zoomed || zooming) return;
  if (!videoEl) return;

  zooming = true;

  const startPos = camera.position.clone();
  const startQuat = camera.quaternion.clone();

  const endPos = initialCamPos.clone();
  const endQuat = initialCamQuat.clone();

  const duration = 800;
  const start = performance.now();

  videoEl.onclick = null;
  videoEl.style.display = "none";
  videoEl.pause();

  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    camera.position.lerpVectors(startPos, endPos, ease);
    camera.quaternion.slerpQuaternions(startQuat, endQuat, ease);

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      zooming = false;
      zoomed = false;

      if (modelRoot) {
        modelRoot.visible = true;
      }
      scene.background = null;

      resetVideoOverlayLayout();
    }
  }

  requestAnimationFrame(step);
}

function resetVideoOverlayLayout() {
  if (!videoEl) return;

  videoEl.pause();
  videoEl.src = VIDEO_URL;

  videoEl.style.position = "absolute";
  const isMobile = isMobileViewport();
  videoEl.style.width = isMobile ? "90%" : "60%";
  videoEl.style.height = isMobile ? "90%" : "60%";
  videoEl.style.left = "50%";
  videoEl.style.top = "0";
  videoEl.style.transform = "translateX(-50%)";
  videoEl.style.marginTop = isMobile ? "-4%" : "-6%";
  videoEl.style.objectFit = "contain";
  videoEl.style.objectPosition = "center";
  videoEl.style.background = "#000";
  videoEl.style.zIndex = "0";
  videoEl.style.display = "block";
  videoEl.style.pointerEvents = "none";

  const p = videoEl.play();
  if (p && p.catch) {
    p.catch(() => {});
  }
}
