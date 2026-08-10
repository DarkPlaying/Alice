import { DoorData } from '../world/DoorSystem';
import { SoundEngine } from '../audio/SoundEngine';
import { CellData, MazeMapData } from '../world/MazeMapData';

export class InteractionUI {
  private instructionsOverlay: HTMLElement | null = null;
  private doorModal: HTMLElement | null = null;
  private doorIdTag: HTMLElement | null = null;
  private doorTitle: HTMLElement | null = null;
  private doorDescription: HTMLElement | null = null;
  private yesBtn: HTMLButtonElement | null = null;
  private noBtn: HTMLButtonElement | null = null;
  private startBtn: HTMLButtonElement | null = null;
  private audioToggleBtn: HTMLButtonElement | null = null;
  private audioIcon: HTMLElement | null = null;
  private proximityBanner: HTMLElement | null = null;
  private proximityText: HTMLElement | null = null;
  private crosshair: HTMLElement | null = null;

  // Map Inspector Modal
  private mapModal: HTMLElement | null = null;
  private mapToggleBtn: HTMLButtonElement | null = null;
  private closeMapBtn: HTMLButtonElement | null = null;
  private mazeGridContainer: HTMLElement | null = null;
  private roomBadgeText: HTMLElement | null = null;

  private activeDoor: DoorData | null = null;
  public isModalOpen: boolean = false;
  private onDoorOpenCallback: ((door: DoorData) => void) | null = null;
  private soundEngine: SoundEngine;

  private currentCell: CellData | null = null;

  constructor(soundEngine: SoundEngine) {
    this.soundEngine = soundEngine;

    this.instructionsOverlay = document.getElementById('instructions-overlay');
    this.doorModal = document.getElementById('door-prompt-modal');
    this.doorIdTag = document.getElementById('door-id-tag');
    this.doorTitle = document.getElementById('door-title');
    this.doorDescription = document.getElementById('door-description');
    this.yesBtn = document.getElementById('door-yes-btn') as HTMLButtonElement;
    this.noBtn = document.getElementById('door-no-btn') as HTMLButtonElement;
    this.startBtn = document.getElementById('start-btn') as HTMLButtonElement;
    this.audioToggleBtn = document.getElementById('audio-toggle-btn') as HTMLButtonElement;
    this.audioIcon = document.getElementById('audio-icon');
    this.proximityBanner = document.getElementById('proximity-banner');
    this.proximityText = document.getElementById('proximity-text');
    this.crosshair = document.getElementById('crosshair');

    // Map elements
    this.mapModal = document.getElementById('map-inspector-modal');
    this.mapToggleBtn = document.getElementById('map-toggle-btn') as HTMLButtonElement;
    this.closeMapBtn = document.getElementById('close-map-btn') as HTMLButtonElement;
    this.mazeGridContainer = document.getElementById('maze-grid-container');
    this.roomBadgeText = document.getElementById('room-badge-text');

    this.setupListeners();
  }

  public setOnDoorOpenCallback(callback: (door: DoorData) => void) {
    this.onDoorOpenCallback = callback;
  }

  private setupListeners() {
    if (this.startBtn) {
      this.startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.soundEngine.init();
        if (this.instructionsOverlay) {
          this.instructionsOverlay.classList.add('hidden');
          this.instructionsOverlay.style.display = 'none';
        }
      });
    }

    if (this.audioToggleBtn) {
      this.audioToggleBtn.addEventListener('click', () => {
        this.soundEngine.init();
        const muted = this.soundEngine.toggleMute();
        if (this.audioIcon) {
          this.audioIcon.textContent = muted ? '🔇' : '🔊';
        }
      });
    }

    if (this.mapToggleBtn) {
      this.mapToggleBtn.addEventListener('click', () => {
        this.openMapModal();
      });
    }

    if (this.closeMapBtn) {
      this.closeMapBtn.addEventListener('click', () => {
        this.closeMapModal();
      });
    }

    if (this.yesBtn) {
      this.yesBtn.addEventListener('click', () => {
        this.handleDoorOpenChoice();
      });
    }

    if (this.noBtn) {
      this.noBtn.addEventListener('click', () => {
        this.closeDoorModal();
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'KeyM' || e.key === 'm' || e.key === 'M') {
        if (this.isModalOpen && this.mapModal && !this.mapModal.classList.contains('hidden')) {
          this.closeMapModal();
        } else if (!this.isModalOpen) {
          this.openMapModal();
        }
      }

      // SPACE BAR or E KEY OPENS DOOR DIRECTLY (No confirmation modal!)
      if (e.code === 'Space' || e.key === ' ' || e.key === 'KeyE' || e.key === 'e' || e.key === 'E') {
        if (this.activeDoor && !this.activeDoor.isOpen) {
          if (this.onDoorOpenCallback) {
            this.onDoorOpenCallback(this.activeDoor);
          }
        }
      }

      if (e.key === 'Escape') {
        if (this.isModalOpen) {
          this.closeDoorModal();
          this.closeMapModal();
        }
      }
    });
  }

  public setCurrentCell(cell: CellData) {
    this.currentCell = cell;
    if (this.roomBadgeText) {
      this.roomBadgeText.textContent = `ROOM ${cell.label} (${cell.x},${cell.y})`;
    }
  }

  public updateProximity(door: DoorData | null, isAnyDoorOpen: boolean) {
    // If any door is already open in the room, disable proximity & block opening other doors
    if (isAnyDoorOpen) {
      this.activeDoor = null;
      if (this.proximityBanner) this.proximityBanner.classList.add('hidden');
      return;
    }

    this.activeDoor = door;

    if (door && !door.isOpen && !this.isModalOpen) {
      if (this.proximityBanner) this.proximityBanner.classList.remove('hidden');
      if (this.proximityText) {
        this.proximityText.textContent = `PRESS [SPACE] OR [E] TO OPEN ${door.title.toUpperCase()}`;
      }
    } else {
      if (this.proximityBanner) this.proximityBanner.classList.add('hidden');
    }
  }

  public openDoorModal(door: DoorData) {
    // Modal bypassed for instant direct open
    if (this.onDoorOpenCallback) {
      this.onDoorOpenCallback(door);
    }
  }

  public closeDoorModal() {
    this.isModalOpen = false;
    if (this.doorModal) this.doorModal.classList.add('hidden');
  }

  private handleDoorOpenChoice() {
    if (this.activeDoor && this.onDoorOpenCallback) {
      this.onDoorOpenCallback(this.activeDoor);
    }
    this.closeDoorModal();
  }

  // --- MAP INSPECTOR MODAL ---
  public openMapModal() {
    this.isModalOpen = true;
    if (this.mapModal) this.mapModal.classList.remove('hidden');
    this.renderMazeGrid();
  }

  public closeMapModal() {
    this.isModalOpen = false;
    if (this.mapModal) this.mapModal.classList.add('hidden');
  }

  private renderMazeGrid() {
    if (!this.mazeGridContainer) return;
    this.mazeGridContainer.innerHTML = '';

    const grid = MazeMapData.getGrid();

    for (let r = 0; r < MazeMapData.GRID_ROWS; r++) {
      for (let c = 0; c < MazeMapData.GRID_COLS; c++) {
        const cellData = grid[r][c];
        const cellEl = document.createElement('div');
        cellEl.className = 'cell';

        if (!cellData) {
          cellEl.classList.add('empty');
        } else {
          cellEl.textContent = cellData.label;

          if (cellData.type === 'entry') cellEl.classList.add('entry');
          if (cellData.type === 'exit') cellEl.classList.add('exit');

          if (this.currentCell && cellData.x === this.currentCell.x && cellData.y === this.currentCell.y) {
            cellEl.classList.add('active');
            const dot = document.createElement('div');
            dot.className = 'cell-dot';
            cellEl.appendChild(dot);
          }

          if (cellData.northDoor) {
            const m = document.createElement('div');
            m.className = 'door-marker north';
            cellEl.appendChild(m);
          }
          if (cellData.southDoor) {
            const m = document.createElement('div');
            m.className = 'door-marker south';
            cellEl.appendChild(m);
          }
          if (cellData.eastDoor) {
            const m = document.createElement('div');
            m.className = 'door-marker east';
            cellEl.appendChild(m);
          }
          if (cellData.westDoor) {
            const m = document.createElement('div');
            m.className = 'door-marker west';
            cellEl.appendChild(m);
          }
        }

        this.mazeGridContainer.appendChild(cellEl);
      }
    }
  }
}
