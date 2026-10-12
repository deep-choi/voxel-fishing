import * as THREE from 'three';
import { Fishing } from './fishing';
import { rodAction } from './data';
import type { PlayerProgress, Rig } from './profile';
import type { FishingGrounds } from './grounds';
import { Float, FishingLine, Hook, Rod, rodRestElevation, type RodPose } from '../render/tackle';
import { VoxelFishModel } from '../render/voxelFishModel';
import { DECK_Y, type RodSlot } from '../world/platforms';
import { WATER_Y } from '../world/lake';

export class MountedRod {
  readonly game: Fishing;
  readonly rod = new Rod();
  readonly float = new Float();
  readonly line = new FishingLine();
  readonly leader = new FishingLine();
  readonly hook = new Hook();
  readonly group = new THREE.Group();
  readonly pose: RodPose;
  readonly restTip = new THREE.Vector3();
  private readonly pull = new THREE.Vector3();
  private readonly hookEye = new THREE.Vector3();
  private readonly mouth = new THREE.Vector3();
  private fishModel: VoxelFishModel | null = null;

  constructor(readonly slot: RodSlot, progress: PlayerProgress, grounds: FishingGrounds, rig: Rig = progress.data.rig) {
    this.game = new Fishing({ x: slot.x, z: slot.z }, progress, grounds);
    this.game.setRig(progress.normalizeRig(rig));
    // 손잡이는 뒤꽂이에, 대는 받침틀에서 정해진 부채꼴 방향으로 눕는다
    this.pose = { butt: new THREE.Vector3(slot.x + Math.sin(slot.yaw) * 0.65, DECK_Y + 0.25, slot.z + Math.cos(slot.yaw) * 0.65), dir: new THREE.Vector3() };
    this.restPose();
    this.restTip.copy(this.pose.butt).addScaledVector(this.pose.dir, this.game.rod.length);
    this.group.add(this.rod.group, this.float.group, this.line.line, this.leader.line, this.hook.group);
    this.leader.line.visible = false;
    this.group.traverse(o => o.layers.set(1));
    this.render();
  }

  update(dt: number, active: boolean) {
    this.group.visible = !active;
    if (active) return;
    this.restPose();
    this.game.update({ dt, primary: false, lift: false, hookset: false, aimYaw: this.slot.yaw, tip: this.restTip, rodDir: this.pose.dir });
    if (this.game.phase !== 'ready' || this.fishModel) this.render(dt);
  }

  private restPose() {
    const elev = rodRestElevation(this.game.rod.length, this.pose.butt.y);
    const c = Math.cos(elev);
    this.pose.dir.set(-Math.sin(this.slot.yaw) * c, Math.sin(elev), -Math.cos(this.slot.yaw) * c);
    this.restTip.copy(this.pose.butt).addScaledVector(this.pose.dir, this.game.rod.length);
  }
  renderNow() { this.restPose(); this.render(); }

  private render(dt = 0) {
    const g = this.game;
    this.pull.subVectors(g.float, this.restTip).normalize();
    this.rod.update(this.pose, g.floatInWater ? this.pull : null, g.phase === 'fighting' ? Math.min(1, g.tension / g.rod.power) : 0.02, g.rod.length, dt, g.rod.flex, rodAction(g.rodId));
    this.float.setScale(g.floatSpec.scale);
    if (g.floatInWater) {
      this.float.place(g.float.x + g.floatSide, g.floatOnLand ? g.float.y : g.phase === 'flying' ? g.float.y : WATER_Y + g.floatDy, g.float.z, g.floatTilt, Math.PI / 2);
    } else this.float.hang(this.rod.tip.x, Math.max(WATER_Y + 0.08, this.rod.tip.y - 0.9), this.rod.tip.z, 0, 0);
    this.line.update(this.rod.tip, this.float.group.position, g.slack);
    this.hook.group.visible = this.leader.line.visible = g.fish !== null;
    if (g.fish) {
      const f = g.fish;
      if (!this.fishModel) {
        this.fishModel = new VoxelFishModel(f.sp.look, f.cm / 100);
        this.fishModel.group.traverse(o => o.layers.set(1));
        this.group.add(this.fishModel.group);
      }
      this.fishModel.group.rotation.y = Math.atan2(-(this.rod.tip.z - f.pos.z), this.rod.tip.x - f.pos.x);
      this.fishModel.amp = 0.03 + f.stamina * 0.05;
      this.fishModel.update(dt);
      this.fishModel.attachMouth(f.pos);
      this.fishModel.getMouth(this.mouth);
      this.hook.place(this.mouth, this.rod.tip, this.hookEye);
      this.line.update(this.rod.tip, this.float.group.position, g.slack * 0.1);
      this.leader.update(this.float.group.position, this.hookEye, 0, false);
    } else if (this.fishModel) {
      this.fishModel.group.removeFromParent(); this.fishModel.dispose(); this.fishModel = null;
    }
  }

  dispose() {
    // 수거한 개별 채비의 GPU 자원만 해제한다.
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.group.traverse(o => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
        geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
      }
    });
    geometries.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
    this.group.removeFromParent();
  }
}
