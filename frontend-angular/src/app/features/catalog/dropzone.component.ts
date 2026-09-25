// Porta de Dropzone em frontend/src/pages/fornecedor/CatalogManage.jsx:737-754
// (só usado ali). Área de arrastar/soltar + clique. `disabled` desliga
// clique/arraste (usado ao atingir o limite de imagens do plano).
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-dropzone',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div
      class="dropzone"
      [class.dropzone-over]="over()"
      [style.opacity]="disabled ? 0.5 : null"
      [style.pointer-events]="disabled ? 'none' : null"
      (click)="inputRef.click()"
      (dragover)="onDragOver($event)"
      (dragleave)="over.set(false)"
      (drop)="onDrop($event)"
    >
      <input
        #inputRef
        type="file"
        accept="image/*"
        [multiple]="multiple"
        [disabled]="disabled"
        style="display:none"
        (change)="onChange($event)"
      />
      <ng-content></ng-content>
      <div class="dz-hint"><app-icon name="catalog" [size]="16"></app-icon> {{ hint }}</div>
    </div>
  `,
})
export class DropzoneComponent {
  @Input() hint = '';
  @Input() multiple = false;
  @Input() disabled = false;
  @Output() readonly files = new EventEmitter<FileList>();

  readonly over = signal(false);

  onDragOver(evento: DragEvent): void {
    evento.preventDefault();
    this.over.set(true);
  }

  onDrop(evento: DragEvent): void {
    evento.preventDefault();
    this.over.set(false);
    const arquivos = evento.dataTransfer?.files;
    if (arquivos?.length) this.files.emit(arquivos);
  }

  onChange(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    if (input.files?.length) this.files.emit(input.files);
    input.value = '';
  }
}
