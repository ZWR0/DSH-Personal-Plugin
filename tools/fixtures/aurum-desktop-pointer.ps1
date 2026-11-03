Add-Type -AssemblyName System.Windows.Forms,System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$form=New-Object System.Windows.Forms.Form
$form.Text='灵犀御机指针验收'
$form.StartPosition='Manual';$form.Location=New-Object Drawing.Point(160,160);$form.ClientSize=New-Object Drawing.Size(1000,620)
$form.BackColor=[Drawing.Color]::FromArgb(29,30,32)
$form.ForeColor=[Drawing.Color]::FromArgb(238,224,186)
$form.Font=New-Object Drawing.Font('Microsoft YaHei UI',14)
$script:left=0;$script:right=0
$label=New-Object Windows.Forms.Label
$label.Text='等待 Agent 依次点击左侧目标和右侧目标';$label.Location=New-Object Drawing.Point(45,35);$label.Size=New-Object Drawing.Size(900,60)
$form.Controls.Add($label)
$first=New-Object Windows.Forms.Button;$first.Text='左侧目标';$first.Location=New-Object Drawing.Point(70,140);$first.Size=New-Object Drawing.Size(220,90)
$second=New-Object Windows.Forms.Button;$second.Text='右侧目标';$second.Location=New-Object Drawing.Point(670,380);$second.Size=New-Object Drawing.Size(220,90)
$user=New-Object Windows.Forms.Button;$user.Text='用户鼠标测试';$user.Location=New-Object Drawing.Point(650,110);$user.Size=New-Object Drawing.Size(240,70)
function Report {
 $label.Text='左侧点击 '+$script:left+' 次；右侧点击 '+$script:right+' 次'
 $a=$first.PointToScreen([Drawing.Point]::Empty);$b=$second.PointToScreen([Drawing.Point]::Empty)
 $value=@{left=$script:left;right=$script:right;leftCenter=@{x=$a.X+110;y=$a.Y+45};rightCenter=@{x=$b.X+110;y=$b.Y+45};windowHandle=$form.Handle.ToInt64()}
 [Console]::Out.WriteLine(($value|ConvertTo-Json -Compress));[Console]::Out.Flush()
}
$first.Add_Click({$script:left++;Report})
$second.Add_Click({$script:right++;Report})
$user.Add_Click({$user.Text='用户鼠标已移动'})
$form.Controls.AddRange(@($first,$second,$user));$form.Add_Shown({Report})
[Windows.Forms.Application]::Run($form)
