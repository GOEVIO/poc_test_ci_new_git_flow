export interface TranslationParams {
    projectName: string;
    componentName: string;
}

export interface FileParams extends TranslationParams {
    lang: string;
}