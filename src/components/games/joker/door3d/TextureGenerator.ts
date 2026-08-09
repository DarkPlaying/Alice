import * as THREE from 'three';

export class TextureGenerator {
  public static createSilverWallTexture(): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 1024, 1024);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#f8fafc');
    grad.addColorStop(1, '#f1f5f9');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 1024);

    ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
    ctx.lineWidth = 3;

    const panelSize = 256;
    for (let x = 0; x <= 1024; x += panelSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    for (let y = 0; y <= 1024; y += panelSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    const nCanvas = document.createElement('canvas');
    nCanvas.width = 1024;
    nCanvas.height = 1024;
    const nCtx = nCanvas.getContext('2d')!;
    nCtx.fillStyle = 'rgb(128, 128, 255)';
    nCtx.fillRect(0, 0, 1024, 1024);

    const rCanvas = document.createElement('canvas');
    rCanvas.width = 1024;
    rCanvas.height = 1024;
    const rCtx = rCanvas.getContext('2d')!;
    rCtx.fillStyle = 'rgb(100, 100, 100)';
    rCtx.fillRect(0, 0, 1024, 1024);

    const map = new THREE.CanvasTexture(canvas);
    const normalMap = new THREE.CanvasTexture(nCanvas);
    const roughnessMap = new THREE.CanvasTexture(rCanvas);

    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;

    return { map, normalMap, roughnessMap };
  }

  public static createSilverFloorTexture(): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1024, 1024);

    ctx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 1024, 0);
      ctx.bezierCurveTo(
        Math.random() * 1024, 300,
        Math.random() * 1024, 700,
        Math.random() * 1024, 1024
      );
      ctx.stroke();
    }

    const nCanvas = document.createElement('canvas');
    nCanvas.width = 1024;
    nCanvas.height = 1024;
    const nCtx = nCanvas.getContext('2d')!;
    nCtx.fillStyle = 'rgb(128, 128, 255)';
    nCtx.fillRect(0, 0, 1024, 1024);

    const rCanvas = document.createElement('canvas');
    rCanvas.width = 1024;
    rCanvas.height = 1024;
    const rCtx = rCanvas.getContext('2d')!;
    rCtx.fillStyle = 'rgb(50, 50, 50)';
    rCtx.fillRect(0, 0, 1024, 1024);

    const map = new THREE.CanvasTexture(canvas);
    const normalMap = new THREE.CanvasTexture(nCanvas);
    const roughnessMap = new THREE.CanvasTexture(rCanvas);

    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;

    return { map, normalMap, roughnessMap };
  }

  public static createModernDoorTexture(): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 1024);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    for (let y = 100; y < 1024; y += 120) {
      ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(492, y); ctx.stroke();
    }

    const map = new THREE.CanvasTexture(canvas);

    const nCanvas = document.createElement('canvas');
    nCanvas.width = 512;
    nCanvas.height = 1024;
    const nCtx = nCanvas.getContext('2d')!;
    nCtx.fillStyle = 'rgb(128, 128, 255)';
    nCtx.fillRect(0, 0, 512, 1024);

    const normalMap = new THREE.CanvasTexture(nCanvas);

    const rCanvas = document.createElement('canvas');
    rCanvas.width = 512;
    rCanvas.height = 1024;
    const rCtx = rCanvas.getContext('2d')!;
    rCtx.fillStyle = 'rgb(90, 90, 90)';
    rCtx.fillRect(0, 0, 512, 1024);

    const roughnessMap = new THREE.CanvasTexture(rCanvas);

    return { map, normalMap, roughnessMap };
  }
}
