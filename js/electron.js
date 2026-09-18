/**
 * electron.js
 * Quản lý trạng thái và hành vi của electron.
 */

const ElectronState = Object.freeze({
  AVAILABLE: 'AVAILABLE',   // Electron hóa trị tự do — cyan
  BONDED:    'BONDED',      // Electron đã tham gia liên kết (chưa gán partner)
  LONE_PAIR: 'LONE_PAIR',   // Cặp electron tự do — vàng cam
  SHARED:    'SHARED'       // Electron dùng chung — hồng
});

class Electron {
  constructor(id, state = ElectronState.AVAILABLE) {
    this.id = id;
    this.state = state;

    this.angle = Math.random() * Math.PI * 2;
    this.speed = 0.008 + Math.random() * 0.006;
    this.radius = 26;

    this.x = 0;
    this.y = 0;

    this.phase = Math.random() * Math.PI * 2;
    this.direction = Math.random() > 0.5 ? 1 : -1;

    this.partnerId = null;
  }

  update(centerX, centerY, time, speedMultiplier = 1) {
    this.angle += this.speed * this.direction * speedMultiplier;
    const wobble = Math.sin(time * 0.002 + this.phase) * 2;
    this.x = centerX + Math.cos(this.angle) * (this.radius + wobble);
    this.y = centerY + Math.sin(this.angle) * (this.radius + wobble);
  }

  setBonded(partnerId) {
    this.state = ElectronState.SHARED;
    this.partnerId = partnerId;
  }

  release() {
    this.state = ElectronState.AVAILABLE;
    this.partnerId = null;
  }
}

window.Electron = Electron;
window.ElectronState = ElectronState;