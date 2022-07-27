import { Component, ReactNode } from 'react';
import CommentInput from './components/CommentInput';
import CommentList from './components/CommentList';
import CommentModel from './model';

interface IState {
  comments: Array<CommentModel>;
}

class App extends Component<unknown, IState> {

  constructor(props: unknown) {
    super(props);

    this.state = {
      comments: [],
    };
  }

  componentWillMount() {
    this._loadComments();
  }

  render(): ReactNode {
    return (
      <div className='wrapper'>
        <CommentInput
          onSubmit={this.handleSubmitContent.bind(this)} />
        <CommentList
          comments={this.state.comments}
          onDeleteComment={this.handleDeleteComment.bind(this)} />
      </div>
    );
  }

  _loadComments() {
    const comments = localStorage.getItem('comments');
    if (comments) {
      this.setState({
        comments: JSON.parse(comments),
      });
    }
  }

  _saveComments(comments: Array<CommentModel>) {
    console.log("_saveComments", comments);
    localStorage.setItem('comments', JSON.stringify(comments));
  }

  handleSubmitContent(username: string, content: string): void {
    const comment: CommentModel = {
      username: username,
      content: content,
      createdTime: +new Date(),
    };
    const comments = [...this.state.comments, comment];
    this.setState({
      comments: comments,
    });
    console.log("handleSubmitContent", comments);
    this._saveComments(comments);
  }

  handleDeleteComment(key: number): void {
    const comments = this.state.comments;
    comments.splice(key, 1);
    this.setState({ comments });
    this._saveComments(comments);
  }
}

export default App;
