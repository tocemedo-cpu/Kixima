import { TestBed } from '@angular/core/testing';
import { DropzoneComponent } from './dropzone.component';

describe('DropzoneComponent', () => {
  function montar(): DropzoneComponent {
    return TestBed.runInInjectionContext(() => new DropzoneComponent());
  }

  it('onDrop() emite os ficheiros largados e esconde o estado "over"', () => {
    const c = montar();
    c.over.set(true);
    const arquivos = { length: 1 } as unknown as FileList;
    let recebido: FileList | undefined;
    c.files.subscribe((f) => (recebido = f));

    c.onDrop({ preventDefault: () => {}, dataTransfer: { files: arquivos } } as unknown as DragEvent);

    expect(recebido).toBe(arquivos);
    expect(c.over()).toBeFalse();
  });

  it('onDrop() sem ficheiros não emite nada', () => {
    const c = montar();
    let chamado = false;
    c.files.subscribe(() => (chamado = true));

    c.onDrop({ preventDefault: () => {}, dataTransfer: { files: { length: 0 } as unknown as FileList } } as unknown as DragEvent);

    expect(chamado).toBeFalse();
  });

  it('onChange() emite os ficheiros escolhidos e limpa o valor do input', () => {
    const c = montar();
    const arquivos = { length: 1 } as unknown as FileList;
    const input = { files: arquivos, value: 'C:\\fake.png' } as unknown as HTMLInputElement;
    let recebido: FileList | undefined;
    c.files.subscribe((f) => (recebido = f));

    c.onChange({ target: input } as unknown as Event);

    expect(recebido).toBe(arquivos);
    expect(input.value).toBe('');
  });

  it('onDragOver() mostra o estado "over"', () => {
    const c = montar();
    c.onDragOver({ preventDefault: () => {} } as unknown as DragEvent);
    expect(c.over()).toBeTrue();
  });
});
