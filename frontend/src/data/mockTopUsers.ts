export interface TopUser {
  id: string;
  rank: number;
  displayName: string;
  username: string;
  score: number;
}

export const mockTopUsers: TopUser[] = [
  { id: "1", rank: 1, displayName: "Кто-то там", username: "его_юз", score: 1488 },
  { id: "2", rank: 2, displayName: "Ещё кто-то", username: "userrr", score: 980 },
  { id: "3", rank: 3, displayName: "Киршик", username: "sixseven", score: 767 },
  { id: "4", rank: 4, displayName: "хз", username: "bebebe", score: 420 },
];
