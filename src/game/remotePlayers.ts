import * as THREE from 'three';
import { RODS, rodAction } from './data';
import type { RemotePlayerState, RemoteRodState } from './onlineState';
import { Rod, rodRestElevation, type RodPose } from '../render/tackle';
import type { Platforms, RodSlot } from '../world/platforms';
import { DECK_Y } from '../world/platforms';

interface RemoteRodView { rodId: string; rod: Rod; pose: RodPose }
interface RemotePlayerView {
  group: THREE.Group;
  geometry: THREE.BoxGeometry;
  label: THREE.Sprite;
  nickname: string;
  target: THREE.Vector3;
  targetYaw: number;
  rods: Map<string, RemoteRodView>;
  labelTexture: THREE.CanvasTexture;
  materials: THREE.Material[];
}

/** 온라인 좌석 상태에서 다른 낚시꾼과 그들이 편 낚싯대를 그린다. */
export class RemotePlayers {
  readonly group = new THREE.Group();
  private readonly actors = new Map<string, RemotePlayerView>();
  private readonly slots: Map<string, RodSlot>;

  constructor(platforms: Platforms, private readonly groundAt: (x: number, z: number) => number) {
    this.group.name = 'remote-anglers';
    this.slots = new Map(platforms.slots.map(slot => [slot.id, slot]));
  }

  setPlayers(players: RemotePlayerState[]) {
    const active = new Set(players.map(player => player.uid));
    for (const [uid, actor] of this.actors) {
      if (!active.has(uid)) this.removeActor(uid, actor);
    }
    for (const player of players) {
      let actor = this.actors.get(player.uid);
      if (!actor) {
        actor = this.createActor(player);
        this.actors.set(player.uid, actor);
        this.group.add(actor.group);
        actor.group.position.set(player.x, this.groundAt(player.x, player.z), player.z);
        actor.group.rotation.y = player.yaw;
      }
      actor.target.set(player.x, this.groundAt(player.x, player.z), player.z);
      actor.targetYaw = player.yaw;
      this.setLabel(actor, player.nickname);
      this.syncRods(actor, player.rodSlots, player.heldRod);
    }
  }

  update(dt: number) {
    const blend = 1 - Math.exp(-dt * 8);
    for (const actor of this.actors.values()) {
      actor.group.position.lerp(actor.target, blend);
      const delta = Math.atan2(Math.sin(actor.targetYaw - actor.group.rotation.y), Math.cos(actor.targetYaw - actor.group.rotation.y));
      actor.group.rotation.y += delta * blend;
    }
  }

  private createActor(player: RemotePlayerState): RemotePlayerView {
    const group = new THREE.Group();
    const cube = new THREE.BoxGeometry(1, 1, 1);
    const hue = this.uidHue(player.uid);
    const clothes = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(hue, 0.48, 0.4) });
    const dark = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(hue, 0.35, 0.24) });
    const skin = new THREE.MeshLambertMaterial({ color: '#d6a27d' });
    const hat = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(hue, 0.58, 0.3) });
    const materials = [clothes, dark, skin, hat];
    const add = (material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) => {
      const mesh = new THREE.Mesh(cube, material);
      mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
    };
    // 단순한 낚시꾼 실루엣: 멀리서도 사람 위치와 바라보는 방향이 보인다.
    add(dark, -0.105, 0.31, 0, 0.18, 0.62, 0.2);
    add(dark, 0.105, 0.31, 0, 0.18, 0.62, 0.2);
    add(clothes, 0, 0.91, 0, 0.48, 0.58, 0.25);
    add(skin, 0, 1.34, 0, 0.34, 0.34, 0.3);
    add(hat, 0, 1.54, 0, 0.43, 0.11, 0.38);
    add(hat, 0, 1.48, -0.12, 0.52, 0.045, 0.26);

    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 80;
    const labelTexture = new THREE.CanvasTexture(canvas);
    labelTexture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false }));
    label.position.set(0, 1.92, 0);
    label.scale.set(1.5, 0.38, 1);
    group.add(label);
    group.traverse(object => object.layers.set(1));

    return { group, geometry: cube, label, nickname: '', target: new THREE.Vector3(), targetYaw: player.yaw, rods: new Map(), labelTexture, materials };
  }

  private setLabel(actor: RemotePlayerView, nickname: string) {
    if (actor.nickname === nickname) return;
    actor.nickname = nickname;
    const canvas = actor.labelTexture.image as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(13, 24, 27, 0.82)';
    context.beginPath(); context.roundRect(4, 4, 312, 72, 25); context.fill();
    context.font = 'bold 38px system-ui, sans-serif';
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillStyle = '#ffffff';
    context.fillText(nickname.slice(0, 12), canvas.width / 2, canvas.height / 2, 286);
    actor.labelTexture.needsUpdate = true;
  }

  private syncRods(actor: RemotePlayerView, rodSlots: RemoteRodState[], held: RemotePlayerState['heldRod']) {
    const desired = new Map<string, { rodId: string; pose: RodPose }>();
    for (const entry of rodSlots) {
      const slot = this.slots.get(entry.slotId);
      const spec = RODS.find(rod => rod.id === entry.rodId);
      if (!slot || !spec) continue;
      const pose = this.restPose(slot, spec.length);
      desired.set(`slot:${slot.id}`, { rodId: spec.id, pose });
    }
    if (held) {
      const spec = RODS.find(rod => rod.id === held.rodId);
      if (spec) {
        desired.set('held', {
          rodId: spec.id,
          pose: {
            butt: new THREE.Vector3(held.buttX, held.buttY, held.buttZ),
            dir: new THREE.Vector3(held.dirX, held.dirY, held.dirZ).normalize(),
          },
        });
      }
    }

    for (const [key, current] of actor.rods) {
      if (!desired.has(key) || desired.get(key)!.rodId !== current.rodId) {
        actor.rods.delete(key); this.removeRod(current);
      }
    }
    for (const [key, item] of desired) {
      let view = actor.rods.get(key);
      if (!view) {
        view = { rodId: item.rodId, rod: new Rod(), pose: { butt: new THREE.Vector3(), dir: new THREE.Vector3() } };
        view.rod.group.traverse(object => object.layers.set(1));
        actor.rods.set(key, view); this.group.add(view.rod.group);
      }
      view.pose.butt.copy(item.pose.butt);
      view.pose.dir.copy(item.pose.dir);
      const spec = RODS.find(rod => rod.id === view!.rodId)!;
      view.rod.update(view.pose, null, 0, spec.length, 0, spec.flex, rodAction(spec.id), 0);
    }
  }

  private restPose(slot: RodSlot, length: number): RodPose {
    const butt = new THREE.Vector3(slot.x + Math.sin(slot.yaw) * 0.65, DECK_Y + 0.25, slot.z + Math.cos(slot.yaw) * 0.65);
    const elev = rodRestElevation(length, butt.y), cos = Math.cos(elev);
    const dir = new THREE.Vector3(-Math.sin(slot.yaw) * cos, Math.sin(elev), -Math.cos(slot.yaw) * cos);
    return { butt, dir };
  }

  private removeActor(uid: string, actor: RemotePlayerView) {
    this.actors.delete(uid);
    this.group.remove(actor.group);
    actor.geometry.dispose();
    actor.labelTexture.dispose();
    actor.materials.forEach(material => material.dispose());
    for (const rod of actor.rods.values()) this.removeRod(rod);
  }

  private removeRod(view: RemoteRodView) {
    this.group.remove(view.rod.group);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    view.rod.group.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }

  private uidHue(uid: string) {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = Math.imul(hash ^ uid.charCodeAt(i), 16777619);
    return ((hash >>> 0) % 360) / 360;
  }
}
