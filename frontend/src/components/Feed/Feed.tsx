import { useEffect, useState } from "react";
import { getPosts } from "../../api/posts";
import type { Post } from "../../types/post";
import { PostCard } from "../PostCard/PostCard";
import { PostCreator } from "../PostCreator/PostCreator";
export function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPosts()
      .then(setPosts)
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="feed">
      <PostCreator />

      {loading ? (
        <p className="feed__status">Загрузка...</p>
      ) : (
        <div className="feed__list">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </main>
  );
}
