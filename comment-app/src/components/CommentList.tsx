import { Component, ReactNode } from 'react';
import CommentModel from '../model';
import Comment from './Comment';

interface IProps {
    comments: CommentModel[];
    onDeleteComment: (key: number) => void;
}

class CommentList extends Component<IProps, unknown> {
    render(): ReactNode {
        return (
            <div>
                {this.props.comments.map((comment: CommentModel, i: number) =>
                    <Comment
                        comment={comment}
                        key={i}
                        onDeleteComment={this.handleDeleteComment.bind(this)} />
                )}
            </div>
        );
    }

    handleDeleteComment(key: number) {
        this.props.onDeleteComment(key);
    }
}

export default CommentList;
