import { Component, ReactNode } from 'react';
import CommentModel from '../model';
import './index.css';

interface IProps {
    key: number;
    comment: CommentModel;
    onDeleteComment: (key: number) => void;
}

interface IState {
    timeString: string;
}

class Comment extends Component<IProps, IState> {
    private timer: number;

    constructor(props: IProps) {
        super(props);
        this.state = {
            timeString: '',
        };
        this.timer = 0;
    }

    componentWillMount() {
        this._updateTimeString();
        this.timer = window.setInterval(
            this._updateTimeString.bind(this),
            5000
        );
    }

    componentWillUnmount() {
        clearInterval(this.timer);
    }

    render(): ReactNode {
        return (
            <div className='comment'>
                <div className='comment-user'>
                    <span>{this.props.comment.username} </span>：
                </div>
                <p>{this.props.comment.content}</p>
                <span className='comment-createdtime'>
                    {this.state.timeString}
                </span>
                <span className='comment-delete' onClick={this.handleDeleteComment.bind(this)}>
                    删除
                </span>
            </div>
        );
    }

    _updateTimeString() {
        const comment = this.props.comment;
        const duration = (+Date.now() - comment.createdTime) / 1000;
        this.setState({
            timeString: duration > 60
                ? `${Math.round(duration / 60)} 分钟前`
                : `${Math.round(Math.max(duration, 1))} 秒前`
        });
    }

    handleDeleteComment() {
        this.props.onDeleteComment(this.props.key);
    }
}

export default Comment;
