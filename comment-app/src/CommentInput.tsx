import React, { Component, ReactNode } from 'react';

interface IProps {
    onSubmit?: (username: string, content: string) => void,
}

interface IState {
    username: string;
    content: string;
}

class CommentInput extends Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);
        this.state = {
            username: '',
            content: '',
        };
    }

    render(): ReactNode {
        return (
            <div className='comment-input'>
                <div className='comment-field'>
                    <span className='comment-field-name'>用户名：</span>
                    <div className='comment-field-input'>
                        <input value={this.state.username} onChange={this.handleUsernameChange.bind(this)} />
                    </div>
                </div>
                <div className='comment-field'>
                    <span className='comment-field-name'>评论内容：</span>
                    <div className='comment-field-input'>
                        <textarea value={this.state.content} onChange={this.handleContentChange.bind(this)} />
                    </div>
                </div>
                <div className='comment-field-button'>
                    <button onClick={this.handleSubmit.bind(this)}>
                        发布
                    </button>
                </div>
            </div>
        );
    }

    handleUsernameChange(event: React.ChangeEvent<HTMLInputElement>): void {
        this.setState({
            username: event.target.value
        });
    }

    handleContentChange(event: React.ChangeEvent<HTMLTextAreaElement>): void {
        this.setState({
            content: event.target.value
        });
    }

    handleSubmit() {
        if (this.props.onSubmit) {
            const { username, content } = this.state;
            if (username === '') {
                alert("username is required");
            }
            if (content === '') {
                alert("content is required");
            }
            this.props.onSubmit(username, content);
            this.setState({
                username: username,
            });
        }
    }
}

export default CommentInput;
