export class GetPokemonListUseCase {
    constructor(catalogPort) {
        this.catalogPort = catalogPort;
    }

    async execute() {
        return this.catalogPort.getList();
    }
}