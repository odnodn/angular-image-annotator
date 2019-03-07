import { AiaImageAnnotatorComponent } from '../aia-image-annotator.component';
import { ElementRef } from '@angular/core';

export type StateName = 'pencil'|'text';

export abstract class DrawState {
    protected getPointFromTouch(ev: TouchEvent, offsetLeft: number, offsetTop: number): Point {
        const touch = ev.changedTouches.item(0);
        const point: Point = {
            x: touch.clientX - offsetLeft,
            y: touch.clientY - offsetTop
        };
        return point;
    }

    abstract getName(): StateName;

    abstract touchStart(imageAnnotator: AiaImageAnnotatorComponent, ev: TouchEvent): void;

    abstract touchMove(imageAnnotator: AiaImageAnnotatorComponent, ev: TouchEvent): void;

    abstract touchEnd(imageAnnotator: AiaImageAnnotatorComponent, ev: TouchEvent): void;

    abstract keyUp(imageAnnotator: AiaImageAnnotatorComponent, ev: KeyboardEvent): void;

    abstract cleanUp(imageAnnotator: AiaImageAnnotatorComponent): void;
}

export class PencilState extends DrawState {
    currentCommand: PencilCommand = new PencilCommand();

    private addPointToCurrentCommand(ev: TouchEvent, offsetLeft: number, offsetTop: number) {
        const point = this.getPointFromTouch(ev, offsetLeft, offsetTop);
        this.currentCommand.addPoint(point);
    }

    public getName(): StateName {
        return 'pencil';
    }

    public touchStart(imageAnnotator: AiaImageAnnotatorComponent, ev: TouchEvent): void {
        this.addPointToCurrentCommand(ev, imageAnnotator.canvasRect.left, imageAnnotator.canvasRect.top);
        this.currentCommand.setColor(<string>imageAnnotator.drawingCtx.fillStyle);
        this.currentCommand.draw(imageAnnotator.drawingCtx);
    }

    public touchMove(imageAnnotator: AiaImageAnnotatorComponent, ev: TouchEvent): void {
        this.addPointToCurrentCommand(ev, imageAnnotator.canvasRect.left, imageAnnotator.canvasRect.top);
        this.currentCommand.draw(imageAnnotator.drawingCtx);
    }

    public touchEnd(imageAnnotator: AiaImageAnnotatorComponent, ev: TouchEvent): void {
        this.addPointToCurrentCommand(ev, imageAnnotator.canvasRect.left, imageAnnotator.canvasRect.top);
        this.currentCommand.draw(imageAnnotator.drawingCtx);
        imageAnnotator.addCommand(this.currentCommand);
        this.currentCommand = new PencilCommand();
    }

    public keyUp(imageAnnotator: AiaImageAnnotatorComponent, ev: KeyboardEvent): void {}

    public cleanUp(imageAnnotator: AiaImageAnnotatorComponent): void {}
}

export class TextState extends DrawState {
    currentCommand: TextCommand;

    public getName(): StateName {
        return 'text';
    }

    private positionTextBox(textBoxRef: ElementRef, x: number, y: number) {
        textBoxRef.nativeElement.style.top = y + 'px';
        textBoxRef.nativeElement.style.left = x + 'px';
    }

    private focusTextBox(textBoxRef: ElementRef) {
        setTimeout(_ => {
            textBoxRef.nativeElement.focus();
        }, 0);
    }

    private clearTextBox(textBoxRef: ElementRef) {
        textBoxRef.nativeElement.value = '';
    }

    private onTextBoxBlur(textBoxRef: ElementRef): Promise<any> {
        return new Promise<any>(resolve => {
            textBoxRef.nativeElement.addEventListener('blur', resolve);
        });
    }

    private recordCommandAndReset(imageAnnotator: AiaImageAnnotatorComponent) {
        this.currentCommand.setColor(<string>imageAnnotator.drawingCtx.fillStyle);
        this.currentCommand.draw(imageAnnotator.drawingCtx);
        imageAnnotator.addCommand(this.currentCommand);
        this.clearTextBox(imageAnnotator.textBoxRef);
        this.currentCommand = null;
    }

    public touchStart(imageAnnotator: AiaImageAnnotatorComponent, ev: TouchEvent): void {
        if (this.currentCommand && !this.currentCommand.empty()) {
            this.recordCommandAndReset(imageAnnotator);
        } else {
            const point = this.getPointFromTouch(ev, imageAnnotator.canvasRect.left, imageAnnotator.canvasRect.top);
            this.currentCommand = new TextCommand(point);
            this.positionTextBox(imageAnnotator.textBoxRef, point.x, point.y);
            this.focusTextBox(imageAnnotator.textBoxRef);
            this.onTextBoxBlur(imageAnnotator.textBoxRef)
                .then(_ => {
                    if (this.currentCommand && !this.currentCommand.empty()) {
                        this.recordCommandAndReset(imageAnnotator);
                    }
                });
        }
    }

    public touchMove(imageAnnotator: AiaImageAnnotatorComponent, ev: TouchEvent): void {
        const point = this.getPointFromTouch(ev, imageAnnotator.canvasRect.left, imageAnnotator.canvasRect.top);
        this.currentCommand.updatePosition(point);
        this.positionTextBox(imageAnnotator.textBoxRef, point.x, point.y);
    }

    public touchEnd(imageAnnotator: AiaImageAnnotatorComponent, ev: TouchEvent): void {
        if (!this.currentCommand) {
            return;
        }
        this.focusTextBox(imageAnnotator.textBoxRef);
    }

    public keyUp(_: AiaImageAnnotatorComponent, ev: KeyboardEvent) {
        if (!this.currentCommand) {
            return;
        }
        this.currentCommand.setText((<HTMLInputElement>ev.target).value);
    }

    public cleanUp(imageAnnotator: AiaImageAnnotatorComponent): void {
        if (this.currentCommand && !this.currentCommand.empty()) {
            this.recordCommandAndReset(imageAnnotator);
        }
    }
}

export interface DrawCommand {
    draw(ctx: CanvasRenderingContext2D): void;
}

interface Point {
    x: number;
    y: number;
}

export class PencilCommand implements DrawCommand {
    private pathArray: Point[] = [];
    private color: string;

    constructor() { }

    public addPoint(point: Point) {
        this.pathArray.push(point);
    }

    public setColor(color: string) {
        this.color = color;
    }

    public draw(ctx: CanvasRenderingContext2D) {
        const currentStrokeStyle = ctx.strokeStyle;
        ctx.strokeStyle = this.color;
        ctx.beginPath();
        for (let i = 1; i < this.pathArray.length; i++) {
            const coord = this.pathArray[i];
            const lastCoord = this.pathArray[i - 1];
            ctx.moveTo(lastCoord.x, lastCoord.y);
            ctx.lineTo(coord.x, coord.y);
            ctx.closePath();
            ctx.stroke();
        }
        ctx.strokeStyle = currentStrokeStyle;
    }
}

export class TextCommand implements DrawCommand {
    private position: Point;
    private text = '';
    private color: string;

    constructor(point: Point) {
        this.position = point;
    }

    public empty(): boolean {
        return this.text === '';
    }

    public updatePosition(point: Point) {
        this.position = point;
    }

    public setText(text: string) {
        this.text = text;
    }

    public setColor(color: string) {
        this.color = color;
    }

    public draw(ctx: CanvasRenderingContext2D) {
        const currentFillStyle = ctx.fillStyle;
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, this.position.x, this.position.y);
        ctx.fillStyle = currentFillStyle;
    }
}


export class ClearCommand implements DrawCommand {
    private canvasWidth;
    private canvasHeight;

    constructor(canvasWidth: number, canvasHeight: number) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
    }

    public draw(ctx: CanvasRenderingContext2D) {
        ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    }
}
