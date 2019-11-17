import {Component, Element, h} from '@stencil/core';

import * as posenet from '@tensorflow-models/posenet';

@Component({
    tag: 'app-motion',
    styleUrl: 'app-motion.scss',
    shadow: true
})
export class AppMotion {

    @Element() el: HTMLAppMotionElement;

    private poseNetModel: posenet.PoseNet;

    private video: HTMLVideoElement;
    private canvas: HTMLCanvasElement;

    async componentWillLoad() {
        this.poseNetModel = await posenet.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            inputResolution: {width: 640, height: 480},
            multiplier: 0.75
        });
    }

    async componentDidLoad() {
        this.video = this.el.shadowRoot.querySelector('video');

        if (this.video) {
            const stream: MediaStream = await navigator.mediaDevices.getUserMedia({
                'audio': false,
                'video': {
                    width: this.video.videoWidth,
                    height: this.video.videoHeight,
                },
            });
            this.video.srcObject = stream;
        }

        this.canvas = this.el.shadowRoot.querySelector('canvas');
    }

    private async detectPoseInRealTime() {
        if (!this.poseNetModel) {
            return;
        }

        if (!this.video) {
            return;
        }

        if (!this.canvas) {
            return;
        }

        this.canvas.width = this.video.width;
        this.canvas.height = this.video.height;

        await this.poseDetectionFrame();
    }

    private async poseDetectionFrame() {
        let poses = [];
        let minPoseConfidence;
        let minPartConfidence;

        const ctx: CanvasRenderingContext2D = this.canvas.getContext('2d');

        const singlePoseDetection = {
            minPoseConfidence: 0.1,
            minPartConfidence: 0.5,
        };

        const pose = await this.poseNetModel.estimatePoses(this.video, {
            flipHorizontal: true,
            decodingMethod: 'single-person'
        });
        poses = poses.concat(pose);
        minPoseConfidence = +singlePoseDetection.minPoseConfidence;
        minPartConfidence = +singlePoseDetection.minPartConfidence;

        ctx.clearRect(0, 0, this.video.width, this.video.height);

        const output = {
            showVideo: true,
            showPoints: true,
        };

        if (output.showVideo) {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-this.video.width, 0);
            ctx.restore();
        }

        poses.forEach(({score, keypoints}) => {
            if (score >= minPoseConfidence) {
                if (output.showPoints) {
                    this.drawKeypoints(keypoints, minPartConfidence, ctx);
                }
            }
        });

        requestAnimationFrame(this.poseDetectionFrame.bind(this));
    }

    private async play() {
        const video: HTMLVideoElement = this.el.shadowRoot.querySelector('video');

        if (video) {
            await video.play();

            await this.detectPoseInRealTime();
        }
    }

    private drawKeypoints(keypoints, minConfidence, ctx, scale = 1) {
        let leftWrist = keypoints.find(point => point.part === 'leftWrist');
        let rightWrist = keypoints.find(point => point.part === 'rightWrist');

        if (leftWrist.score > minConfidence) {
            const {y, x} = leftWrist.position;
            this.drawPoint(ctx, y * scale, x * scale, 10, 'red');
        }

        if (rightWrist.score > minConfidence) {
            const {y, x} = rightWrist.position;
            this.drawPoint(ctx, y * scale, x * scale, 10, 'green');
        }
    }

    private drawPoint(ctx, y, x, r, color) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
    }

    render() {
        return [
            <p>Experiment gesture</p>,
            <video width={640} height={480} onLoadedMetaData={() => this.play()}></video>,
            <canvas></canvas>
        ]
    }

}
