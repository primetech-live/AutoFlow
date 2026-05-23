import React, { useState } from 'react';
import { CloseIcon, FolderIcon } from './Icons';

interface InitOptions {
    projectName: string;
    gitRepo: string;
    domain: string;
    strictCI: boolean;
    useVolumes: boolean;
}

interface InitProjectModalProps {
    projectPath: string;
    onConfirm: (options: InitOptions) => void;
    onCancel: () => void;
}

export const InitProjectModal: React.FC<InitProjectModalProps> = ({ projectPath, onConfirm, onCancel }) => {
    const separator = projectPath.includes('\\') ? '\\' : '/';
    const defaultName = projectPath.split(separator).pop() || 'app';

    const [projectName, setProjectName] = useState(defaultName);
    const [gitRepo, setGitRepo] = useState('');
    const [domain, setDomain] = useState('');
    const [strictCI, setStrictCI] = useState(true);
    const [useVolumes, setUseVolumes] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm({
            projectName,
            gitRepo,
            domain,
            strictCI,
            useVolumes
        });
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ width: '480px' }}>
                <form onSubmit={handleSubmit}>
                    <div className="modal-header">
                        <h3 className="h2" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FolderIcon size={18} /> Initialize Project
                        </h3>
                        <button type="button" onClick={onCancel} className="btn btn-secondary" style={{ padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CloseIcon size={14} />
                        </button>
                    </div>

                    <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <p className="text-secondary" style={{ fontSize: '13px' }}>
                            Configure deployment settings for <strong>{projectPath}</strong>
                        </p>

                        <div className="form-group">
                            <label className="form-label">Project Name</label>
                            <input
                                type="text"
                                className="input"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">GitHub Repository URL (Optional)</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="https://github.com/user/repo"
                                value={gitRepo}
                                onChange={(e) => setGitRepo(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Domain / Subdomain (Optional)</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="app.example.com (Leave empty for IP:PORT mode)"
                                value={domain}
                                onChange={(e) => setDomain(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                <input
                                    type="checkbox"
                                    checked={strictCI}
                                    onChange={(e) => setStrictCI(e.target.checked)}
                                />
                                <div>
                                    <div style={{ fontWeight: 600 }}>Enable Strict CI</div>
                                    <div className="text-secondary" style={{ fontSize: '11px' }}>Fails deployment if tests are missing or failing</div>
                                </div>
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                                <input
                                    type="checkbox"
                                    checked={useVolumes}
                                    onChange={(e) => setUseVolumes(e.target.checked)}
                                />
                                <div>
                                    <div style={{ fontWeight: 600 }}>Enable Persistent Volumes</div>
                                    <div className="text-secondary" style={{ fontSize: '11px' }}>Recommended if the app has local SQLite databases or uploaded files</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="submit" className="btn btn-primary">Initialize Project</button>
                        <button type="button" onClick={onCancel} className="btn btn-secondary">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
