import { Component, ReactNode } from 'react';
import CommentModel from './model';

interface IProps {
    key: number;
    comment: CommentModel;
}

class Comment extends Component<IProps, unknown> {
    render(): ReactNode {
        return (
            <div className='comment'>
                <div className='comment-user'>
                    <span>{this.props.comment.username} </span>：
                </div>
                <p>{this.props.comment.content}</p>
            </div>
        );
    }
}

export default Comment;
