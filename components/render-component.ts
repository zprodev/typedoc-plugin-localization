import { Component, RendererComponent } from 'typedoc/dist/lib/output/components';
import * as path from 'path';
import { ReflectionKind } from 'typedoc/dist/lib/models';
import { FileOperations } from '../utils/file-operations';
import { AttributeType } from '../utils/enums/json-obj-kind';
import { Constants } from '../utils/constants';
import { RendererEvent } from 'typedoc/dist/lib/output/events';

@Component({ name: 'render-component'})
export class RenderComponenet extends RendererComponent {
    fileOperations: FileOperations;
    data: JSON;
    mainDirOfJsons: string;
    globalFuncsData;

    public initialize() {
        this.listenTo(this.owner, {
            [RendererEvent.BEGIN]: this.onRenderBegin,
        });
        
        this.fileOperations = new FileOperations(this.application.logger);
    }

    private onRenderBegin(event: RendererEvent) {
        
        const reflections = event.project.reflections;
        const options = this.application.options.getRawValues();
        const localizeOpt = options[Constants.RENDER_COMMAND];
        if (localizeOpt) {
            this.mainDirOfJsons = localizeOpt;
            this.globalFuncsData = this.fileOperations.getFileData(this.mainDirOfJsons, Constants.GLOBAL_FUNCS_FILE_NAME, 'json');
            this.runCommentReplacements(reflections);
        }
    }

    private runCommentReplacements(reflections) {
        const keys = Object.keys(reflections);
        keys.forEach(key => {
            const reflection = reflections[key];
            this.processTheReflection(reflection);
        });
    }

    private processTheReflection(reflection) {
        switch(reflection.kind) {
            case ReflectionKind.Class:
            case ReflectionKind.Enum:
            case ReflectionKind.Interface:
                    const filePath = reflection.sources[0].fileName;
                    let processedDir = this.mainDirOfJsons;
                    const parsedPath = this.fileOperations.getProcessedDir(filePath);
                    if (parsedPath) {
                        processedDir = `${processedDir}\\${parsedPath}`;
                    }
                    this.data = this.fileOperations.getFileData(processedDir, reflection.name, 'json');
                    if (this.data) {
                        this.updateComment(reflection, this.data[reflection.name]);
                    }
                break;
            case ReflectionKind.Property:
            case ReflectionKind.CallSignature:
            case ReflectionKind.EnumMember:
                    if (reflection.parent === ReflectionKind.Function) {
                        break;
                    }

                    const parent = this.getParentBasedOnType(reflection, reflection.kind);
                    const parentName = parent.name;
                    const attributeName = reflection.name;
                    const attributeData = this.getAttributeData(parentName, AttributeType[reflection.kind], attributeName);
                    if(attributeData) {
                        this.updateComment(reflection, attributeData);
                    }
                break;
            case ReflectionKind.Function:
                    if (!this.globalFuncsData) {
                        break;
                    }
                    const funcName = reflection.name;
                    const funcData = this.globalFuncsData[funcName];
                    this.updateComment(reflection.signatures[0], funcData);
                break;
            case ReflectionKind.GetSignature:
            case ReflectionKind.SetSignature:
                    const accessorParent = this.getParentBasedOnType(reflection, reflection.kind);
                    const accessor = reflection.parent;
                    const accessorSignature = reflection.kind;
                    const data = this.getAccessorAttributeData(accessorParent.name, AttributeType[accessor.kind], accessor.name, AttributeType[accessorSignature]);
                    if (data) {
                        this.updateComment(reflection, data);
                    }
                break;
            default:
                return;
        }
    }

    private getAttribute(parentName, attribute) {
        if (this.data && this.data[parentName]) {
            return this.data[parentName][attribute];
        }
    }

    private getAttributeData(parentName, attribute, attributeName) {
        const data = this.getAttribute(parentName, attribute);
        if (data) {
            return data[attributeName];
        }
    }

    private getAccessorAttributeData(parentName, attribute, attributeName, accessorType) {
        const data = this.getAttributeData(parentName, attribute, attributeName);
        if (data) {
            return data[accessorType];
        }
    }

    private updateComment(reflection, dataObj) {
        if (!reflection.comment || !dataObj[Constants.COMMENT]) {
            return;
        }

        let parsed;
        if(reflection.comment.text) {
            parsed = dataObj[Constants.COMMENT][Constants.TEXT].join('\n');
            reflection.comment.text = parsed;
        }

        if(reflection.comment.shortText) {
            parsed = dataObj[Constants.COMMENT][Constants.SHORT_TEXT].join('\n');
            reflection.comment.shortText = parsed;
        }
    }

    private getParentBasedOnType(reflection, kind) {
        if (kind === ReflectionKind.CallSignature || 
            kind === ReflectionKind.GetSignature || 
            kind === ReflectionKind.SetSignature) {
                return reflection.parent.parent;
        }

        return reflection.parent;
    }
}