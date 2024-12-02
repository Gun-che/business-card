import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, ViewChild } from '@angular/core';
import { Nullable } from 'src/app/types/nullable';
import { neonCursor } from 'src/app/three/neon-cursor';


@Component({
  selector: 'background',
  standalone: true,
  imports: [],
  templateUrl: './background.component.html',
  styleUrl: './background.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BackgroundComponent implements AfterViewInit {
  @ViewChild('background') public backgroundRef: Nullable<ElementRef>;

  public ngAfterViewInit() {
    this.initBackground();
  }

  private initBackground() {
    neonCursor({
      el: this.backgroundRef?.nativeElement,
      eventsEl: window.document.body,
      shaderPoints: 16,
      curvePoints: 80,
      curveLerp: 0.95,
      radius1: 10,
      radius2: 150,
      velocityTreshold: 10,
      sleepRadiusX: 100,
      sleepRadiusY: 100,
      sleepTimeCoefX: 0.0025,
      sleepTimeCoefY: 0.0025
    });
  }
}
