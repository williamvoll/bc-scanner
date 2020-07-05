import { CustomURLEncoder } from './shared/custom-encoder';
import { UploadImageResponse } from './shared/interfaces';
import { Component, ViewChild, ElementRef, Inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BarcodeFormat } from '@zxing/library';
import { BehaviorSubject } from 'rxjs';
import { FormatsDialogComponent } from './formats-dialog/formats-dialog.component';
import { AppInfoDialogComponent } from './app-info-dialog/app-info-dialog.component';
import { ZXingScannerComponent } from './public_api';
import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  isLoading = false;
  imageUrl = null;

  availableDevices: MediaDeviceInfo[];
  currentDevice: MediaDeviceInfo = null;
  isShown = false;

  @ViewChild('scannervideo') videoRef: ZXingScannerComponent;
  get video(): HTMLVideoElement {
    return this.videoRef.previewElemRef.nativeElement;
  }

  @ViewChild('barcodeimage') barcodeImageRef: ElementRef;
  get imageDiv(): HTMLElement {
    return this.barcodeImageRef.nativeElement;
  }

  @ViewChild('canvas') canvasRef: ElementRef;
  get canvas(): HTMLCanvasElement {
    return this.canvasRef.nativeElement;
  }

  formatsEnabled: BarcodeFormat[] = [
    BarcodeFormat.CODE_128,
    BarcodeFormat.DATA_MATRIX,
    BarcodeFormat.EAN_13,
    BarcodeFormat.QR_CODE,
  ];

  hasDevices: boolean;
  hasPermission: boolean;

  qrResultString: string;

  torchEnabled = false;
  torchAvailable$ = new BehaviorSubject<boolean>(false);
  tryHarder = false;

  constructor(
    private readonly _dialog: MatDialog,
    @Inject(DOCUMENT) private document,
    private http: HttpClient) { }

  clearResult(): void {
    this.qrResultString = null;
    this.imageUrl = false;
  }

  onCamerasFound(devices: MediaDeviceInfo[]): void {
    this.availableDevices = devices;
    this.hasDevices = Boolean(devices && devices.length);
  }

  onCodeResult(resultString: string) {
    if (this.isLoading) {
      return;
    }

    this.qrResultString = resultString;
    this.saveImage();
  }

  saveImage(): void {
    const canv = this.document.createElement('canvas');
    canv.width = this.video.videoWidth;
    canv.height = this.video.videoHeight;
    this.imageDiv.appendChild(canv);

    const context = canv.getContext('2d').drawImage(this.video, 0, 0, this.video.videoWidth, this.video.videoHeight);
    let encodedImage: string = canv.toDataURL('image/png');

    this.imageDiv.removeChild(canv);

    let params: HttpParams = new HttpParams();

    // params = params.append('text', this.qrResultString);
    const dataString = 'data:image/png;base64,';
    // encodedImage = 'data:image/png;base64,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';
    encodedImage = encodedImage.substr(dataString.length, encodedImage.length - dataString.length);
    // params = params.append('image', encodedImage);
    // encodedImage = 'zalupazzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz';
    this.qrResultString = this.qrResultString || 'test barcode';
    const rawParams = {'text': this.qrResultString || 'notext', 'image': encodedImage};
    const encodedParams = JSON.stringify(rawParams);
    params = params.set('data', encodedParams);

    const newParams = new HttpParams({encoder: new CustomURLEncoder() })
        .set('data', encodedParams);

    this.isLoading = true;
    this.http.post('https://skatilsya.com/test/upwork/barcodes/upload.php', newParams, {
      headers: new HttpHeaders().set('Content-Type', 'application/x-www-form-urlencoded;charset=utf-8')
    }).subscribe(response => {
      const res = response as UploadImageResponse;
      // console.log(res.file, res.text);
      this.imageUrl = res.file;
      this.isLoading = false;
    });

    // this.captures.push(this.canvas.toDataURL("image/png"));
    // console.log('video:', this.video);
  }

  onDeviceSelectChange(selected: string) {
    const device = this.availableDevices.find(x => x.deviceId === selected);
    this.currentDevice = device || null;
  }

  openFormatsDialog() {
    const data = {
      formatsEnabled: this.formatsEnabled,
    };

    this._dialog
      .open(FormatsDialogComponent, { data })
      .afterClosed()
      .subscribe(x => { if (x) { this.formatsEnabled = x; } });
  }

  onHasPermission(has: boolean) {
    this.hasPermission = has;
  }

  openInfoDialog() {
    const data = {
      hasDevices: this.hasDevices,
      hasPermission: this.hasPermission,
    };

    this._dialog.open(AppInfoDialogComponent, { data });
  }

  onTorchCompatible(isCompatible: boolean): void {
    this.torchAvailable$.next(isCompatible || false);
  }

  toggleTorch(): void {
    this.torchEnabled = !this.torchEnabled;
  }

  toggleTryHarder(): void {
    this.tryHarder = !this.tryHarder;
  }
}
