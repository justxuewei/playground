import { Component, ReactNode } from 'react';
import CommentInput from './CommentInput';
import CommentList from './CommentList';

class App extends Component {
  render(): ReactNode {
      return (
        <div className='wrapper'>
          <CommentInput />
          <CommentList />
        </div>
      );
  }

  handleSubmitContent(username: string, content: string): void {
    console.log(username, content);
  }
}

export default App;
