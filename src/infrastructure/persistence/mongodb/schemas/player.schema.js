import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema({
  nickname: { type: String, required: true, maxlength: 30 },
  lobbyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lobby', default: null },
}, { timestamps: true });

playerSchema.index({ lobbyId: 1 });

export const PlayerModel = mongoose.models.Player ?? mongoose.model('Player', playerSchema);
