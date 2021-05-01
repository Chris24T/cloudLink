export function ProgressBarItem(props) {
    const {max, min, current, name} = props.info

    return (
        <div>
            name: {name}
            max: {max},
            min: {min},
            current: {current}
        </div>
    )

    return (



            <div className="progressBar">
                <div className="progressBar_info"> <span>{name}</span></div>
                <div className="progressBar_bar">

                <div class="progress-bar" role="progressbar" style={{width:"15%"}} ></div>
                <div class="progress-bar bg-success" role="progressbar" style={{width:"15%"}} ></div>
                <div class="progress-bar bg-info" role="progressbar" style={{width:"15%"}} ></div>
                    Progress
                </div>

            </div>



    )
}
