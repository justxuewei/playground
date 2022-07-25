import { Component, ReactNode } from 'react';
import CommentInput from './CommentInput';
import CommentList from './CommentList';
import CommentModel from './model';

interface IState {
  comments: Array<CommentModel>;
}

class App extends Component<unknown, IState> {
  constructor(props: unknown) {
    console.log("App constructor");
    super(props);

    this.state = {
      comments: [],
    };
    console.log("App constructor", this.state);
  }

  render(): ReactNode {
    return (
      <div className='wrapper'>
        <CommentInput onSubmit={this.handleSubmitContent.bind(this)} />
        <CommentList comments={this.state.comments} />
      </div>
    );
  }

  handleSubmitContent(username: string, content: string): void {
    const comment: CommentModel = {
      username: username,
      content: content
    };
    this.setState({
      comments: this.state.comments.concat(comment),
    });
  }
}

export default App;
