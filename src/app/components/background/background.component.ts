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
      shaderPoints: 20,
      curvePoints: 40,
      curveLerp: 0.9,
      radius1: 10,
      radius2: 150,
      velocityTreshold: 200
    });
  }
}
