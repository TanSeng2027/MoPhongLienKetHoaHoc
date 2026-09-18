/**
 * app.js
 * Điểm khởi tạo ứng dụng.
 */

window.appMode = 'basic';

document.addEventListener('DOMContentLoaded', () => {
  const svg = document.getElementById('sim-svg');
  const workspace = document.getElementById('workspace');

  const sim = new Simulation(svg, workspace);
  sim.setAnimating(true);
  sim.setAnimSpeed(1);

  const ui = new UI(sim);

  window.sim = sim;
  window.ui = ui;

  console.log('⚛ Molecular Lab đã sẵn sàng!');
});