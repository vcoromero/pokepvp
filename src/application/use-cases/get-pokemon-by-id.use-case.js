export class GetPokemonByIdUseCase {
    constructor(catalogPort) {
        this.catalogPort = catalogPort;
    }

    async execute(id) {
        return this.catalogPort.getById(id);
    }
}