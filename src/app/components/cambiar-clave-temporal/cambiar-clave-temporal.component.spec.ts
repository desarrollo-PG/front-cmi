import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CambiarClaveTemporalComponent } from './cambiar-clave-temporal.component';

describe('CambiarClaveTemporalComponent', () => {
  let component: CambiarClaveTemporalComponent;
  let fixture: ComponentFixture<CambiarClaveTemporalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CambiarClaveTemporalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CambiarClaveTemporalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
