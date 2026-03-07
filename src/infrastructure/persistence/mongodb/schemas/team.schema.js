import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
  lobbyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lobby', required: true },
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  pokemonIds: [{ type: Number }],
}, { timestamps: true });

teamSchema.index({ lobbyId: 1, playerId: 1 }, { unique: true });

export const TeamModel = mongoose.models.Team ?? mongoose.model('Team', teamSchema);
