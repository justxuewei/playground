import { PureComponent, ReactNode } from 'react';
import { CommentListContainer } from './CommentList';

class App extends PureComponent {

  // componentWillMount() {
  //   this._loadComments();
  // }

  render(): ReactNode {
    return (
      <div className='wrapper'>
        {/* <CommentInput /> */}
        <CommentListContainer />
      </div>
    );
  }

  // _loadComments() {
  //   const comments = localStorage.getItem('comments');
  //   if (comments) {
  //     this.setState({
  //       comments: JSON.parse(comments),
  //     });
  //   }
  // }

  // _saveComments(comments: Array<CommentModel>) {
  //   console.log("_saveComments", comments);
  //   localStorage.setItem('comments', JSON.stringify(comments));
  // }

  // handleSubmitContent(username: string, content: string): void {
  //   const comment: CommentModel = {
  //     username: username,
  //     content: content,
  //     createdTime: +new Date(),
  //   };
  //   const comments = [...this.state.comments, comment];
  //   this.setState({
  //     comments: comments,
  //   });
  //   console.log("handleSubmitContent", comments);
  //   this._saveComments(comments);
  // }

  // handleDeleteComment(key: number): void {
  //   const comments = this.state.comments;
  //   comments.splice(key, 1);
  //   this.setState({ comments });
  //   this._saveComments(comments);
  // }
}

export default App;
