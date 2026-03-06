export class ThirdPartyApiFailedError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'ThirdPartyApiFailedError';
        this.status = status;
    }
}